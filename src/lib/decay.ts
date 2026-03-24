import { db } from "@/lib/db"
import { files, decayEvents, users } from "@/lib/db/schema"
import { eq, ne, and } from "drizzle-orm"
import { deleteFromR2 } from "@/lib/r2"
import { sendDecayWarningEmail, sendDecayDeletedEmail } from "@/lib/email"

// ─── Thresholds ───────────────────────────────────────────
export const DECAY_THRESHOLDS = {
  WARN: 0.5,       // 50% decayed → email warning
  COMPRESS: 0.75,  // 75% decayed → mark as compressed (R2 lifecycle handles actual compression)
  CRITICAL: 0.9,   // 90% → final warning email
  DELETE: 1.0,     // 100% → delete permanently
} as const

// ─── Per-plan decay rates (days until fully decayed) ──────
export const PLAN_DECAY_RATES = {
  free: 14,
  starter: 30,
  pro: 90,
} as const

// ─── Calculate current decay score ────────────────────────
export function calculateDecayScore(
  lastAccessedAt: Date,
  decayRateDays: number
): number {
  const now = Date.now()
  const lastAccess = lastAccessedAt.getTime()
  const msSinceAccess = now - lastAccess
  const daysSinceAccess = msSinceAccess / (1000 * 60 * 60 * 24)
  const score = daysSinceAccess / decayRateDays
  return Math.min(score, 1.0)
}

// ─── Get decay color for UI ───────────────────────────────
export function getDecayColor(score: number): string {
  if (score < 0.25) return "#22c55e"
  if (score < 0.5) return "#84cc16"
  if (score < 0.75) return "#eab308"
  if (score < 0.9) return "#f97316"
  return "#ef4444"
}

// ─── Get decay label for UI ───────────────────────────────
export function getDecayLabel(score: number): string {
  if (score < 0.25) return "Fresh"
  if (score < 0.5) return "Aging"
  if (score < 0.75) return "Stale"
  if (score < 0.9) return "Critical"
  return "Expiring"
}

// ─── Days until deletion ──────────────────────────────────
export function getDaysUntilDeletion(
  lastAccessedAt: Date,
  decayRateDays: number
): number {
  const score = calculateDecayScore(lastAccessedAt, decayRateDays)
  const remaining = (1 - score) * decayRateDays
  return Math.max(0, Math.floor(remaining))
}

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

        // Handle deletion
        if (newStatus === "deleted") {
          await deleteFromR2(file.r2Key)

          // Fetch user explicitly (avoids 'never' type from relation join)
          const fileUser = await db.query.users.findFirst({
            where: eq(users.id, file.userId),
          })

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
          const fileUser = await db.query.users.findFirst({
            where: eq(users.id, file.userId),
          })
          await sendDecayWarningEmail(fileUser?.email ?? "", file.originalFilename, daysLeft, "warning")
          stats.warned++
        }

        // Send critical warning email
        if (newStatus === "critical" && oldStatus !== "critical") {
          const daysLeft = getDaysUntilDeletion(file.lastAccessedAt, file.decayRateDays)
          const fileUser = await db.query.users.findFirst({
            where: eq(users.id, file.userId),
          })
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