import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { z } from "zod"

type Params = { params: { id: string } }

// Valid decay rate options (days). Pro users may choose any; others are locked
// to their plan default via the upload flow and cannot call this endpoint.
const ALLOWED_DECAY_RATES = [7, 14, 30, 60, 90, 180, 365] as const

const decayRateSchema = z.object({
  decayRateDays: z.number().refine(
    (v) => (ALLOWED_DECAY_RATES as readonly number[]).includes(v),
    { message: `decayRateDays must be one of: ${ALLOWED_DECAY_RATES.join(", ")}` }
  ),
})

// ─── PATCH /api/files/[id]/decay-rate ─────────────────────
// Pro plan only. Updates the decay rate for an existing file.
// Immediately recalculates the effective decay clock from lastAccessedAt.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    // Gate to Pro plan only
    if (user.plan !== "pro") {
      return NextResponse.json(
        { error: "Custom decay rates are available on the Pro plan only." },
        { status: 403 }
      )
    }

    const parsed = decayRateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid decay rate" },
        { status: 400 }
      )
    }

    const { decayRateDays } = parsed.data

    // Verify the file belongs to this user and is not deleted
    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    if (file.status === "deleted") {
      return NextResponse.json({ error: "Cannot update a deleted file" }, { status: 410 })
    }

    const [updated] = await db
      .update(files)
      .set({ decayRateDays })
      .where(eq(files.id, params.id))
      .returning()

    return NextResponse.json({ file: updated })
  } catch (err) {
    console.error("[PATCH /api/files/[id]/decay-rate]", err)
    return NextResponse.json({ error: "Failed to update decay rate" }, { status: 500 })
  }
}