// ROUTE: GET /api/admin/waitlist
// FILE:  src/app/api/admin/waitlist/route.ts
//
// Returns all waitlist entries, ordered by joinedAt asc.
// Protected by ADMIN_SECRET bearer token (same as approve route).

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { asc } from "drizzle-orm"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const entries = await db.query.waitlist.findMany({
      orderBy: asc(waitlist.joinedAt),
    })

    return NextResponse.json({ ok: true, entries })
  } catch (err) {
    console.error("[GET /api/admin/waitlist]", err)
    return NextResponse.json({ error: "Failed to fetch waitlist" }, { status: 500 })
  }
}