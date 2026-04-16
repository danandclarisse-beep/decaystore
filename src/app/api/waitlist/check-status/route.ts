// ROUTE: POST /api/waitlist/check-status
// FILE:  src/app/api/waitlist/check-status/route.ts
//
// PURPOSE:
//   Called by /sso-callback immediately after a Clerk OAuth session is
//   established. Returns whether the authenticated user's email is approved
//   to access the app (waitlist.status === "signed_up").
//
//   This is an authenticated endpoint — it requires a valid Clerk session.
//   The email in the request body is cross-checked against the session's
//   own email to prevent one user from checking another's status.
//
// SECURITY NOTE:
//   The response is deliberately minimal — it returns { approved: bool, status: string }
//   and nothing else. It does not expose queue position, joinedAt, or any other
//   waitlist metadata to the client.

import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  // Must be authenticated — this endpoint is called right after OAuth completes
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Cross-check: verify the email in the request body actually belongs to
  // the authenticated Clerk user. Prevents status fishing.
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const sessionEmail = clerkUser?.emailAddresses[0]?.emailAddress

  let body: { email: string }
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (!sessionEmail || sessionEmail.toLowerCase() !== body.email.toLowerCase()) {
    return NextResponse.json({ error: "Email mismatch" }, { status: 403 })
  }

  const bypass = process.env.BYPASS_WAITLIST === "true"
  if (bypass) {
    return NextResponse.json({ approved: true, status: "signed_up" })
  }

  const entry = await db.query.waitlist.findFirst({
    where: eq(waitlist.email, sessionEmail),
  })

  if (!entry) {
    return NextResponse.json({ approved: false, status: "not_found" })
  }

    // Fix check-status to accept both transitional states:
    return NextResponse.json({
    approved: entry.status === "signed_up" || entry.status === "approved",
    status: entry.status,
    })
}