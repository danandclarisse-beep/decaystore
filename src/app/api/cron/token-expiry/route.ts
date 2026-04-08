// ROUTE: GET /api/cron/token-expiry
// FILE:  src/app/api/cron/token-expiry/route.ts

export const maxDuration = 60
export const dynamic     = "force-dynamic"

import { NextResponse }                  from "next/server"
import { db }                            from "@/lib/db"
import { waitlist }                      from "@/lib/db/schema"
import { eq, and, lt }                   from "drizzle-orm"
import { sendWaitlistTokenExpiredEmail } from "@/lib/email"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let swept  = 0
  let failed = 0

  try {
    const expiredTokens = await db.query.waitlist.findMany({
      where: and(
        eq(waitlist.status, "approved"),
        lt(waitlist.tokenExpiresAt, new Date())
      ),
    })

    for (const entry of expiredTokens) {
      try {
        await db
          .update(waitlist)
          .set({ status: "token_expired", token: null })
          .where(eq(waitlist.id, entry.id))

        await sendWaitlistTokenExpiredEmail(entry.email)
        swept++
      } catch (err) {
        console.error(`[TOKEN-EXPIRY] Failed for email=${entry.email}:`, err)
        failed++
      }
    }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), stats: { swept, failed } })
  } catch (err) {
    console.error("[TOKEN-EXPIRY] Fatal:", err)
    return NextResponse.json({ error: "Token expiry cron failed" }, { status: 500 })
  }
}