export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { storageSnapshots, files } from "@/lib/db/schema"
import { eq, and, ne, desc, gte } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { calculateDecayScore } from "@/lib/decay-utils"

// ─── GET /api/analytics — Pro usage analytics ─────────────
// Returns 30-day storage snapshots, file count trend,
// decay status distribution, and top renewed files.
// Pro plan only — returns 403 otherwise.
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    if (user.plan !== "pro") {
      return NextResponse.json({ error: "Pro plan required" }, { status: 403 })
    }

    // ── 30-day storage snapshots ───────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const snapshots = await db.query.storageSnapshots.findMany({
      where: and(
        eq(storageSnapshots.userId, user.id),
        gte(storageSnapshots.snapshotDate, thirtyDaysAgo)
      ),
      orderBy: [desc(storageSnapshots.snapshotDate)],
    })

    // ── Active files for decay distribution + top renewed ──
    const activeFiles = await db.query.files.findMany({
      where: and(
        eq(files.userId, user.id),
        ne(files.status, "deleted"),
        eq(files.uploadConfirmed, true)
      ),
      orderBy: [desc(files.lastAccessedAt)],
    })

    // Decay status distribution
    const decayBuckets = { fresh: 0, aging: 0, stale: 0, critical: 0, expiring: 0 }
    for (const f of activeFiles) {
      const score = calculateDecayScore(new Date(f.lastAccessedAt), f.decayRateDays)
      if (score < 0.25)      decayBuckets.fresh++
      else if (score < 0.5)  decayBuckets.aging++
      else if (score < 0.75) decayBuckets.stale++
      else if (score < 0.9)  decayBuckets.critical++
      else                   decayBuckets.expiring++
    }

    // Top 5 most recently renewed (lowest decay = most recently accessed)
    const topRenewed = [...activeFiles]
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, 5)
      .map((f) => ({
        id:               f.id,
        originalFilename: f.originalFilename,
        lastAccessedAt:   f.lastAccessedAt,
        decayScore:       calculateDecayScore(new Date(f.lastAccessedAt), f.decayRateDays),
        sizeBytes:        f.sizeBytes,
      }))

    return NextResponse.json({
      snapshots: snapshots.map((s) => ({
        date:             s.snapshotDate,
        storageUsedBytes: s.storageUsedBytes,
        fileCount:        s.fileCount,
      })),
      currentStorageBytes: user.storageUsedBytes,
      currentFileCount:    activeFiles.length,
      decayDistribution:   decayBuckets,
      topRenewed,
    })
  } catch (err) {
    console.error("[GET /api/analytics]", err)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}