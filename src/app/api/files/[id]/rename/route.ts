import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"

type Params = { params: { id: string } }

// ─── PATCH /api/files/[id]/rename ─────────────────────────
// Body: { name: string }
// Only renames the display name (originalFilename).
// The R2 key is immutable — renaming is metadata only.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const { name } = await request.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 })
    }
    if (name.trim().length > 255) {
      return NextResponse.json({ error: "File name too long (max 255 chars)" }, { status: 400 })
    }

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    if (file.status === "deleted") return NextResponse.json({ error: "File is deleted" }, { status: 410 })

    const [updated] = await db
      .update(files)
      .set({ originalFilename: name.trim() })
      .where(eq(files.id, params.id))
      .returning()

    return NextResponse.json({ file: updated })
  } catch (err) {
    console.error("[PATCH /api/files/[id]/rename]", err)
    return NextResponse.json({ error: "Failed to rename file" }, { status: 500 })
  }
}