// ─── SERVER-ONLY decay operations ────────────────────────
// This file imports db, r2, and email — NEVER import it from a "use client" component.
// For UI utilities (colors, labels, scores), import from @/lib/decay-utils instead.

import { db } from "@/lib/db"
import { files, fileVersions, decayEvents, users } from "@/lib/db/schema"
import { eq, ne, and, inArray } from "drizzle-orm"
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
  errors: string[]
}> {
  const stats = { processed: 0, warned: 0, critical: 0, deleted: 0, errors: [] as string[] }

  // Fetch all active/warned/compressed files (no relation join to avoid type issues)
  const activeFiles = await db.query.files.findMany({
    where: ne(files.status, "deleted"),
  })

  // [P3-1] Pre-fetch all users referenced by these files in a single query.
  // Previously every status-changing file triggered a separate findFirst,
  // causing up to N serial DB round-trips per cron run.
  const uniqueUserIds = Array.from(new Set(activeFiles.map((f) => f.userId)))
  const affectedUsers = uniqueUserIds.length > 0
    ? await db.query.users.findMany({ where: inArray(users.id, uniqueUserIds) })
    : []
  const userMap = new Map(affectedUsers.map((u) => [u.id, u]))

  for (const file of activeFiles) {
    try {
      const newScore = calculateDecayScore(file.lastAccessedAt, file.decayRateDays)
      const oldStatus = file.status
      let newStatus = file.status

      // Determine new status based on score
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

      // Update decay score in DB
      await db
        .update(files)
        .set({
          decayScore: newScore,
          status: newStatus,
          ...(newStatus === "deleted" ? { deletedAt: new Date() } : {}),
          ...(newStatus === "warned" && !file.warnedAt ? { warnedAt: new Date() } : {}),
        })
        .where(eq(files.id, file.id))

      // Log event if status changed
      if (newStatus !== oldStatus) {
        await db.insert(decayEvents).values({
          fileId: file.id,
          userId: file.userId,
          eventType: newStatus,
          decayScoreAtEvent: newScore,
        })

        // Resolve user from pre-fetched map (no extra DB query)
        const fileUser = userMap.get(file.userId)

        // Handle deletion
        if (newStatus === "deleted") {
          // [P1-3] Fetch all version records and delete every R2 object,
          // not just the current version key. Without this, superseded
          // version objects accumulate in R2 indefinitely.
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
          // Remove all version DB records
          await db.delete(fileVersions).where(eq(fileVersions.fileId, file.id))

          // Update user storage count
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

        // Send warning email
        if (newStatus === "warned" && oldStatus === "active") {
          const daysLeft = getDaysUntilDeletion(file.lastAccessedAt, file.decayRateDays)
          await sendDecayWarningEmail(fileUser?.email ?? "", file.originalFilename, daysLeft, "warning")
          stats.warned++
        }

        // Send critical warning email
        if (newStatus === "critical" && oldStatus !== "critical") {
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