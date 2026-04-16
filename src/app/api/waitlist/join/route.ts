// ROUTE: POST /api/waitlist/join
// FILE:  src/app/api/waitlist/join/route.ts
//
// FIXES APPLIED:
//   [Issue 6 — MEDIUM] Rate limiting is now applied to this endpoint.
//     Previously, lib/rate-limit.ts existed but was not applied here,
//     leaving the endpoint open to:
//       - Email enumeration (response differs for new vs duplicate entries)
//       - DB spam with thousands of fake email rows
//       - Resend quota exhaustion via rapid unique-email submissions
//     Fix: apply the existing rateLimit() function keyed by client IP address.
//     Limit: 3 requests per 10 minutes per IP — tight enough to stop automation,
//     loose enough to not frustrate real users who mistype their email.
//     The X-Forwarded-For header is used (set by Vercel's edge); falls back to
//     a static key if the header is absent (local dev / direct invocation).

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { count, inArray } from "drizzle-orm"
import { sendWaitlistConfirmationEmail } from "@/lib/email"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"

const schema = z.object({ email: z.string().email() })

const WAITLIST_CAP = parseInt(process.env.WAITLIST_CAP ?? "100", 10)

// [FIX Issue 6] 3 attempts per 10 minutes per IP.
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000

export async function POST(request: NextRequest) {
  // [FIX Issue 6] Extract caller IP from Vercel's edge header.
  // X-Forwarded-For may be a comma-separated list; the first entry is the client IP.
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown"

  const rl = rateLimit(ip, "waitlist-join", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1_000)),
        },
      }
    )
  }

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