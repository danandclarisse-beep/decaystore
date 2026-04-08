// ─── SERVER-ONLY decay operations ────────────────────────
// This file imports db, r2, and email — NEVER import it from a "use client" component.
// For UI utilities (colors, labels, scores), import from @/lib/decay-utils instead.

import { db } from "@/lib/db"
import { files, fileVersions, decayEvents, users } from "@/lib/db/schema"
import { eq, ne, and, inArray, lt, gt, asc, SQL } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { deleteFromR2 } from "@/lib/r2"
import { sendDecayWarningEmail, sendDecayDeletedEmail } from "@/lib/email"
import {
  DECAY_THRESHOLDS,
  calculateDecayScore,
  getDaysUntilDeletion,
} from "@/lib/decay-utils"

// Re-export everything from decay-utils so existing server-side imports
// (api routes, cron) that use `from "@/lib/decay"` keep working unchanged.
export {
  DECAY_THRESHOLDS,
  PLAN_DECAY_RATES,
  calculateDecayScore,
  getDecayColor,
  getDecayLabel,
  getDaysUntilDeletion,
} from "@/lib/decay-utils"

// ─── Main decay runner (called by cron) ───────────────────
export async function runDecayCycle(): Promise<{
  processed: number
  warned: number
  critical: number
  deleted: number
  ghostsPruned: number
  pages: number
  errors: string[]
}> {
  const stats = { processed: 0, warned: 0, critical: 0, deleted: 0, ghostsPruned: 0, pages: 0, errors: [] as string[] }

  // [P6-3] Prune ghost upload records — cursor-paginated (P15-7)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  let ghostCursor: string | undefined = undefined
  let ghostHasMore = true
  while (ghostHasMore) {
    const ghostConditions: SQL[] = [
      eq(files.uploadConfirmed, false),
      lt(files.uploadedAt, oneHourAgo),
    ]
    if (ghostCursor) ghostConditions.push(gt(files.id, ghostCursor))

    const ghostPage: InferSelectModel<typeof files>[] = await db.query.files.findMany({
      where: and(...ghostConditions),
      orderBy: [asc(files.id)],
      limit: 500,
    })
    if (ghostPage.length === 0) break
    for (const ghost of ghostPage) {
      try {
        await deleteFromR2(ghost.r2Key).catch(() => {})
        await db.delete(files).where(eq(files.id, ghost.id))
        stats.ghostsPruned++
      } catch (err) {
        stats.errors.push(`Ghost ${ghost.id}: ${err instanceof Error ? err.message : "unknown"}`)
      }
    }
    ghostHasMore = ghostPage.length === 500
    ghostCursor = ghostPage[ghostPage.length - 1].id
  }

  // [P15-7] Process active files in cursor-paginated pages of 500.
  // Keeps peak memory constant regardless of total file count and prevents
  // Vercel's 60-second function timeout at high file counts.
  const PAGE_SIZE = 500
  let cursor: string | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const pageConditions: SQL[] = [
      ne(files.status, "deleted"),
      eq(files.uploadConfirmed, true),
    ]
    if (cursor) pageConditions.push(gt(files.id, cursor))

    const page: InferSelectModel<typeof files>[] = await db.query.files.findMany({
      where: and(...pageConditions),
      orderBy: [asc(files.id)],
      limit: PAGE_SIZE,
    })

    if (page.length === 0) break
    stats.pages++

    // [P3-1] Pre-fetch all users referenced in this page in a single query.
    const uniqueUserIds: string[] = Array.from(new Set(page.map((f) => f.userId)))
    const affectedUsers = uniqueUserIds.length > 0
      ? await db.query.users.findMany({ where: inArray(users.id, uniqueUserIds) })
      : []
    const userMap = new Map(affectedUsers.map((u) => [u.id, u]))

    for (const file of page) {
      try {
        const newScore = calculateDecayScore(file.lastAccessedAt, file.decayRateDays)
        const oldStatus = file.status
        let newStatus = file.status

        if (newScore >= DECAY_THRESHOLDS.DELETE) {
          newStatus = "deleted"
        } else if (newScore >= DECAY_THRESHOLDS.CRITICAL) {
          newStatus = "critical"
        } else if (newScore >= DECAY_THRESHOLDS.COMPRESS) {
          newStatus = "compressed"
        } else if (newScore >= DECAY_THRESHOLDS.WARN) {
          newStatus = "warned"
        } else {
          newStatus = "active"
        }

        await db
          .update(files)
          .set({
            decayScore: newScore,
            status: newStatus,
            ...(newStatus === "deleted" ? { deletedAt: new Date() } : {}),
            ...(newStatus === "warned" && !file.warnedAt ? { warnedAt: new Date() } : {}),
          })
          .where(eq(files.id, file.id))

        if (newStatus !== oldStatus) {
          await db.insert(decayEvents).values({
            fileId: file.id,
            userId: file.userId,
            eventType: newStatus,
            decayScoreAtEvent: newScore,
          })

          const fileUser = userMap.get(file.userId)

          if (newStatus === "deleted") {
            const versions = await db.query.fileVersions.findMany({
              where: eq(fileVersions.fileId, file.id),
            })
            const keysToDelete = [
              file.r2Key,
              ...versions.map((v) => v.r2Key).filter((k) => k !== file.r2Key),
            ]
            for (const key of keysToDelete) {
              await deleteFromR2(key)
            }
            await db.delete(fileVersions).where(eq(fileVersions.fileId, file.id))

            await db
              .update(users)
              .set({
                storageUsedBytes: Math.max(
                  0,
                  (fileUser?.storageUsedBytes ?? 0) - file.sizeBytes
                ),
              })
              .where(eq(users.id, file.userId))

            await sendDecayDeletedEmail(fileUser?.email ?? "", file.originalFilename)
            stats.deleted++
          }

          // [P13-4] Respect decayWarningsEnabled
          if (newStatus === "warned" && oldStatus === "active" && fileUser?.decayWarningsEnabled !== false) {
            const daysLeft = getDaysUntilDeletion(file.lastAccessedAt, file.decayRateDays)
            await sendDecayWarningEmail(fileUser?.email ?? "", file.originalFilename, daysLeft, "warning")
            stats.warned++
          }

          if (newStatus === "critical" && oldStatus !== "critical" && fileUser?.decayWarningsEnabled !== false) {
            const daysLeft = getDaysUntilDeletion(file.lastAccessedAt, file.decayRateDays)
            await sendDecayWarningEmail(fileUser?.email ?? "", file.originalFilename, daysLeft, "critical")
            stats.critical++
          }
        }

        stats.processed++
      } catch (err) {
        stats.errors.push(`File ${file.id}: ${err instanceof Error ? err.message : "unknown error"}`)
      }
    }

    hasMore = page.length === PAGE_SIZE
    cursor = page[page.length - 1].id
  }

  return stats
}

// ─── Renew a file (reset decay) ───────────────────────────
export async function renewFile(fileId: string, userId: string) {
  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, userId)),
  })

  if (!file) throw new Error("File not found")
  if (file.status === "deleted") throw new Error("Cannot renew deleted file")

  await db
    .update(files)
    .set({
      lastAccessedAt: new Date(),
      decayScore: 0,
      status: "active",
      warnedAt: null,
    })
    .where(eq(files.id, fileId))

  await db.insert(decayEvents).values({
    fileId: file.id,
    userId,
    eventType: "renewed",
    decayScoreAtEvent: 0,
  })

  return { success: true }
}