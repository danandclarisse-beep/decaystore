import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { folders, files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"

type Params = { params: { id: string } }

// ─── PATCH /api/folders/[id] — rename folder ──────────────
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const { name } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Folder name too long (max 100 chars)" }, { status: 400 })
    }

    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.id, params.id), eq(folders.userId, user.id)),
    })
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    const [updated] = await db
      .update(folders)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(folders.id, params.id))
      .returning()

    return NextResponse.json({ folder: updated })
  } catch (err) {
    console.error("[PATCH /api/folders/[id]]", err)
    return NextResponse.json({ error: "Failed to rename folder" }, { status: 500 })
  }
}

// ─── DELETE /api/folders/[id] — delete folder ─────────────
// Files inside are moved to root (folderId = null), not deleted.
// Sub-folders are also moved to root. This matches industry standard
// behavior (e.g. Google Drive: deleting a folder doesn't delete contents).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.id, params.id), eq(folders.userId, user.id)),
    })
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    // Move files inside to root
    await db
      .update(files)
      .set({ folderId: null })
      .where(and(eq(files.folderId, params.id), eq(files.userId, user.id)))

    // Move sub-folders to root
    await db
      .update(folders)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(eq(folders.parentId, params.id), eq(folders.userId, user.id)))

    // Delete the folder itself
    await db
      .delete(folders)
      .where(and(eq(folders.id, params.id), eq(folders.userId, user.id)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/folders/[id]]", err)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}