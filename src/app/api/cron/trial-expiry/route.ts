// ROUTE: GET /api/cron/trial-expiry
// FILE:  src/app/api/cron/trial-expiry/route.ts

export const maxDuration = 60
export const dynamic     = "force-dynamic"

import { NextResponse }          from "next/server"
import { db }                    from "@/lib/db"
import { users, files }          from "@/lib/db/schema"
import { eq, and, lt }           from "drizzle-orm"
import { sendTrialExpiredEmail } from "@/lib/email"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  let converted   = 0
  let expired     = 0
  let failed      = 0

  try {
    const expiredTrials = await db.query.users.findMany({
      where: and(
        eq(users.plan, "trial"),
        lt(users.trialEndsAt, new Date())
      ),
    })

    for (const user of expiredTrials) {
      try {
        // Check LemonSqueezy subscription status
        let isConverted = false

        if (user.billingSubscriptionId) {
          const res = await fetch(
            `https://api.lemonsqueezy.com/v1/subscriptions/${user.billingSubscriptionId}`,
            { headers: { Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` } }
          )
          if (res.ok) {
            const data = await res.json()
            const status = data.data?.attributes?.status as string
            // Fix: include "on_trial" — user has an active subscription even if
            // LemonSqueezy hasn't yet transitioned them to "active"
            isConverted = ["active", "on_trial"].includes(status)
          }
        }

        if (isConverted) {
          await db
            .update(users)
            .set({ plan: "pro", trialEndsAt: null, updatedAt: new Date() })
            .where(eq(users.id, user.id))
          converted++
        } else {
          const now = new Date()
          await db
            .update(users)
            .set({ plan: "trial_expired", trialExpiredAt: now, updatedAt: new Date() })
            .where(eq(users.id, user.id))

          // Reset decay clock to 14 days on all files
          await db
            .update(files)
            .set({ decayRateDays: 14, lastAccessedAt: now })
            .where(eq(files.userId, user.id))

          const firstDeletionDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
          await sendTrialExpiredEmail(user.email, firstDeletionDate)
          expired++
        }
      } catch (err) {
        console.error(`[TRIAL-EXPIRY] Failed for userId=${user.id}:`, err)
        failed++
      }
    }

    console.log("[TRIAL-EXPIRY] Complete", { converted, expired, failed, durationMs: Date.now() - startedAt })
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), stats: { converted, expired, failed } })
  } catch (err) {
    console.error("[TRIAL-EXPIRY] Fatal:", err)
    return NextResponse.json({ error: "Trial expiry cron failed" }, { status: 500 })
  }
}