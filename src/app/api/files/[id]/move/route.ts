import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, folders } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"

type Params = { params: { id: string } }

// ─── POST /api/files/[id]/move — move file to folder ──────
// Body: { folderId: string | null }  (null = move to root)
export async function POST(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const { folderId } = await request.json()

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    if (file.status === "deleted") return NextResponse.json({ error: "File is deleted" }, { status: 410 })

    // Validate target folder belongs to this user
    if (folderId !== null && folderId !== undefined) {
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, user.id)),
      })
      if (!folder) return NextResponse.json({ error: "Target folder not found" }, { status: 404 })
    }

    const [updated] = await db
      .update(files)
      .set({ folderId: folderId ?? null })
      .where(eq(files.id, params.id))
      .returning()

    return NextResponse.json({ file: updated })
  } catch (err) {
    console.error("[POST /api/files/[id]/move]", err)
    return NextResponse.json({ error: "Failed to move file" }, { status: 500 })
  }
}