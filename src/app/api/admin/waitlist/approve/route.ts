// ROUTE: POST /api/admin/waitlist/approve
// FILE:  src/app/api/admin/waitlist/approve/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { sendWaitlistApprovedEmail } from "@/lib/email"
import { randomBytes } from "crypto"
import { z } from "zod"

const schema = z.object({ count: z.number().int().min(1).max(100) })

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { count: batchSize } = schema.parse(body)

    const pending = await db.query.waitlist.findMany({
      where: eq(waitlist.status, "pending"),
      orderBy: asc(waitlist.joinedAt),
      limit: batchSize,
    })

    let approved = 0
    for (const entry of pending) {
      const token          = randomBytes(32).toString("hex")
      const tokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

      await db
        .update(waitlist)
        .set({ status: "approved", token, tokenExpiresAt, approvedAt: new Date() })
        .where(eq(waitlist.id, entry.id))

      await sendWaitlistApprovedEmail(entry.email, token)
      approved++
    }

    return NextResponse.json({ ok: true, approved })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    console.error("[POST /api/admin/waitlist/approve]", err)
    return NextResponse.json({ error: "Approval failed" }, { status: 500 })
  }
}