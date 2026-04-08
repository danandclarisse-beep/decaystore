export const maxDuration = 60
export const dynamic     = "force-dynamic"

import { NextResponse }                                      from "next/server"
import { db }                                                from "@/lib/db"
import { users }                                             from "@/lib/db/schema"
import { eq, and, sql }                                      from "drizzle-orm"
import { sendTrialWarningEmail, sendTrialDecayWarningEmail } from "@/lib/email"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let sent   = 0
  let failed = 0

  try {
    // Day 10: 4 days remaining
    const fourDayWarnings = await db.query.users.findMany({
      where: and(
        eq(users.plan, "trial"),
        sql`DATE(trial_ends_at) = CURRENT_DATE + INTERVAL '4 days'`
      ),
    })
    for (const user of fourDayWarnings) {
      try { await sendTrialWarningEmail(user.email, 4); sent++ }
      catch (err) { console.error(`[TRIAL-WARNINGS] 4-day failed for ${user.email}:`, err); failed++ }
    }

    // Day 13: 1 day remaining
    const oneDayWarnings = await db.query.users.findMany({
      where: and(
        eq(users.plan, "trial"),
        sql`DATE(trial_ends_at) = CURRENT_DATE + INTERVAL '1 day'`
      ),
    })
    for (const user of oneDayWarnings) {
      try { await sendTrialWarningEmail(user.email, 1); sent++ }
      catch (err) { console.error(`[TRIAL-WARNINGS] 1-day failed for ${user.email}:`, err); failed++ }
    }

    // Day 21: 7 days before first deletion (trial_expired_at + 7 days = today)
    const decayWarnings = await db.query.users.findMany({
      where: and(
        eq(users.plan, "trial_expired"),
        sql`DATE(trial_expired_at) = CURRENT_DATE - INTERVAL '7 days'`
      ),
    })
    for (const user of decayWarnings) {
      try {
        const firstDeletionDate = new Date(user.trialExpiredAt!.getTime() + 14 * 24 * 60 * 60 * 1000)
        await sendTrialDecayWarningEmail(user.email, firstDeletionDate)
        sent++
      } catch (err) {
        console.error(`[TRIAL-WARNINGS] decay warn failed for ${user.email}:`, err)
        failed++
      }
    }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), stats: { sent, failed } })
  } catch (err) {
    console.error("[TRIAL-WARNINGS] Fatal:", err)
    return NextResponse.json({ error: "Trial warnings cron failed" }, { status: 500 })
  }
}