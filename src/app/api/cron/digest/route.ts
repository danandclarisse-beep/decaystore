export const maxDuration = 60
export const dynamic    = "force-dynamic"

import { NextResponse }           from "next/server"
import { db }                     from "@/lib/db"
import { users, files }           from "@/lib/db/schema"
import { eq, and, gte, ne }       from "drizzle-orm"
import { calculateDecayScore }    from "@/lib/decay-utils"
import { sendWeeklyDigestEmail }  from "@/lib/email"

// ─── GET /api/cron/digest — weekly decay summary email ────────
// Called by Vercel Cron on a weekly schedule (see vercel.json).
// Protected by CRON_SECRET. Gated to Starter + Pro users who have
// emailDigestEnabled = true.
//
// For each eligible user, groups all active files whose LIVE decay
// score is ≥ 50% and sends a single digest email.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  let usersProcessed = 0
  let emailsSent     = 0
  let emailsFailed   = 0
  let usersSkipped   = 0

  try {
    // ── 1. Fetch Starter + Pro users with digest enabled ────────
    const eligibleUsers = await db.query.users.findMany({
      where: and(
        ne(users.plan, "free"),
        eq(users.emailDigestEnabled, true)
      ),
    })

    // ── 2. For each user, find files with live decay score ≥ 50% ─
    for (const user of eligibleUsers) {
      usersProcessed++

      const activeFiles = await db.query.files.findMany({
        where: and(
          eq(files.userId, user.id),
          eq(files.uploadConfirmed, true),
          ne(files.status, "deleted"),
        ),
      })

      // Compute live decay scores client-side (same formula as cron)
      const atRiskFiles = activeFiles
        .map((f) => ({
          ...f,
          liveDecayScore: calculateDecayScore(f.lastAccessedAt, f.decayRateDays),
        }))
        .filter((f) => f.liveDecayScore >= 0.5)
        .sort((a, b) => b.liveDecayScore - a.liveDecayScore)

      if (atRiskFiles.length === 0) {
        usersSkipped++
        continue
      }

      // ── 3. Send digest email via Resend ─────────────────────
      try {
        await sendWeeklyDigestEmail(user.email, user.plan, atRiskFiles)
        emailsSent++
      } catch (emailErr) {
        console.error(`[DIGEST] Failed to send email to ${user.email}:`, emailErr)
        emailsFailed++
      }
    }

    const durationMs = Date.now() - startedAt
    console.log("[DIGEST] Complete", { usersProcessed, emailsSent, emailsFailed, usersSkipped, durationMs })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats: { usersProcessed, emailsSent, emailsFailed, usersSkipped, durationMs },
    })
  } catch (err) {
    console.error("[DIGEST] Fatal error:", err)
    return NextResponse.json(
      { error: "Digest cron failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    )
  }
}