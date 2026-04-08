// ROUTE: GET /api/waitlist/count
// FILE:  src/app/api/waitlist/count/route.ts

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { count, inArray } from "drizzle-orm"

const WAITLIST_CAP = parseInt(process.env.WAITLIST_CAP ?? "100", 10)

export async function GET() {
  try {
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(waitlist)
      .where(inArray(waitlist.status, ["approved", "signed_up"]))

    return NextResponse.json({
      remaining: Math.max(0, WAITLIST_CAP - Number(activeCount)),
      total: WAITLIST_CAP,
    })
  } catch (err) {
    console.error("[GET /api/waitlist/count]", err)
    return NextResponse.json({ error: "Failed to get count" }, { status: 500 })
  }
}