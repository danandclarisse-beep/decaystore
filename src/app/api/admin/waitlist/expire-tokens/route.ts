// ROUTE: POST /api/admin/waitlist/expire-tokens
// FILE:  src/app/api/admin/waitlist/expire-tokens/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq, and, lt } from "drizzle-orm"
import { sendWaitlistTokenExpiredEmail } from "@/lib/email"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const expired = await db.query.waitlist.findMany({
      where: and(
        eq(waitlist.status, "approved"),
        lt(waitlist.tokenExpiresAt, new Date())
      ),
    })

    let swept = 0
    for (const entry of expired) {
      await db
        .update(waitlist)
        .set({ status: "token_expired", token: null })
        .where(eq(waitlist.id, entry.id))

      await sendWaitlistTokenExpiredEmail(entry.email)
      swept++
    }

    return NextResponse.json({ ok: true, swept })
  } catch (err) {
    console.error("[POST /api/admin/waitlist/expire-tokens]", err)
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 })
  }
}