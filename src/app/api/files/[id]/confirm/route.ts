import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"

type Params = { params: { id: string } }

// ─── POST /api/files/[id]/confirm ─────────────────────────
// [P6-3] Called by the client immediately after the R2 PUT succeeds.
// Sets uploadConfirmed = true so the file is visible in GET /api/files.
// Unconfirmed records older than 1 hour are cleaned up by the decay cron.
export async function POST(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })

    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Idempotent — safe to call multiple times
    if (file.uploadConfirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true })
    }

    await db
      .update(files)
      .set({ uploadConfirmed: true })
      .where(eq(files.id, params.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /api/files/[id]/confirm]", err)
    return NextResponse.json({ error: "Failed to confirm upload" }, { status: 500 })
  }
}