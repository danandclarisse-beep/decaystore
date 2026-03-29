export const maxDuration = 60
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, files, storageSnapshots } from "@/lib/db/schema"
import { eq, ne, and, sql } from "drizzle-orm"

// ─── GET /api/cron/snapshot — daily storage snapshot ──────
// Runs daily at 03:00 UTC (see vercel.json).
// For every active user, writes a snapshot row of current
// storageUsedBytes + confirmed file count. Used by the
// Pro analytics panel to show a 30-day storage trend.
//
// [P10-3] File counts are fetched in a single GROUP BY aggregate
// query instead of one findMany() per user (N+1 fix — same
// pattern applied to the decay cron in Phase 3).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  let usersProcessed = 0
  let snapshotsWritten = 0

  try {
    const allUsers = await db.query.users.findMany()

    // Single aggregate query: count confirmed, non-deleted files per user.
    // Replaces the previous per-user findMany() loop (N+1 DB round-trips).
    const fileCounts = await db
      .select({
        userId:    files.userId,
        fileCount: sql<number>`cast(count(*) as int)`,
      })
      .from(files)
      .where(
        and(
          ne(files.status, "deleted"),
          eq(files.uploadConfirmed, true)
        )
      )
      .groupBy(files.userId)

    // Build a Map for O(1) look-up inside the insert loop
    const fileCountByUser = new Map<string, number>(
      fileCounts.map((r) => [r.userId, r.fileCount])
    )

    for (const user of allUsers) {
      try {
        const fileCount = fileCountByUser.get(user.id) ?? 0

        await db.insert(storageSnapshots).values({
          userId:           user.id,
          storageUsedBytes: user.storageUsedBytes,
          fileCount,
        })

        snapshotsWritten++
        usersProcessed++
      } catch {
        // Skip failed users — don't abort the whole run
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      usersProcessed,
      snapshotsWritten,
      durationMs: Date.now() - start,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Snapshot cron failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    )
  }
}