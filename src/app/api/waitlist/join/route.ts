// ROUTE: POST /api/waitlist/join
// FILE:  src/app/api/waitlist/join/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { count, inArray } from "drizzle-orm"
import { sendWaitlistConfirmationEmail } from "@/lib/email"
import { z } from "zod"

const schema = z.object({ email: z.string().email() })

const WAITLIST_CAP = parseInt(process.env.WAITLIST_CAP ?? "100", 10)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = schema.parse(body)

    // Count spots already claimed (approved + signed_up) — pending don't hold a spot
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(waitlist)
      .where(inArray(waitlist.status, ["approved", "signed_up"]))

    // Insert — ignore duplicate emails; check rows affected to avoid double-emailing
    const inserted = await db
      .insert(waitlist)
      .values({ email })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id })

    // Only send confirmation if this was a new entry
    if (inserted.length > 0) {
      const [{ value: position }] = await db
        .select({ value: count() })
        .from(waitlist)

      await sendWaitlistConfirmationEmail(email, Number(position))

      return NextResponse.json({
        ok: true,
        position: Number(position),
        isFull: Number(activeCount) >= WAITLIST_CAP,
      })
    }

    // Duplicate — return a neutral response without re-emailing
    return NextResponse.json({
      ok: true,
      alreadyJoined: true,
      isFull: Number(activeCount) >= WAITLIST_CAP,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    console.error("[POST /api/waitlist/join]", err)
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 })
  }
}