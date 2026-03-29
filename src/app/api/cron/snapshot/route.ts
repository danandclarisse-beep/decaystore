export const maxDuration = 60
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, files, storageSnapshots } from "@/lib/db/schema"
import { eq, ne, and } from "drizzle-orm"

// ─── GET /api/cron/snapshot — daily storage snapshot ──────
// Runs daily at 03:00 UTC (see vercel.json).
// For every active user, writes a snapshot row of current
// storageUsedBytes + confirmed file count. Used by the
// Pro analytics panel to show a 30-day storage trend.
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

    for (const user of allUsers) {
      try {
        // Count only confirmed, non-deleted files
        const userFiles = await db.query.files.findMany({
          where: and(
            eq(files.userId, user.id),
            ne(files.status, "deleted"),
            eq(files.uploadConfirmed, true)
          ),
          columns: { id: true },
        })

        await db.insert(storageSnapshots).values({
          userId:           user.id,
          storageUsedBytes: user.storageUsedBytes,
          fileCount:        userFiles.length,
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