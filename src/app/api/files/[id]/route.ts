import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedDownloadUrl, deleteFromR2 } from "@/lib/r2"
import { renewFile } from "@/lib/decay"

type Params = { params: { id: string } }

// ─── GET /api/files/[id] — get download URL ───────────────
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })

    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    if (file.status === "deleted") return NextResponse.json({ error: "File has been deleted" }, { status: 410 })

    // Update last accessed timestamp (resets decay slightly)
    await db
      .update(files)
      .set({ lastAccessedAt: new Date() })
      .where(eq(files.id, file.id))

    const downloadUrl = await getPresignedDownloadUrl(file.r2Key)

    return NextResponse.json({ downloadUrl, file })
  } catch (err) {
    console.error("[GET /api/files/[id]]", err)
    return NextResponse.json({ error: "Failed to get file" }, { status: 500 })
  }
}

// ─── PATCH /api/files/[id] — renew file ───────────────────
export async function PATCH(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const result = await renewFile(params.id, user.id)

    return NextResponse.json(result)
  } catch (err) {
    console.error("[PATCH /api/files/[id]]", err)
    return NextResponse.json({ error: "Failed to renew file" }, { status: 500 })
  }
}

// ─── DELETE /api/files/[id] — manual delete ───────────────
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })

    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Delete from R2
    if (file.status !== "deleted") {
      await deleteFromR2(file.r2Key)
    }

    // Mark as deleted in DB
    await db
      .update(files)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(files.id, file.id))

    // Update storage usage
    await db
      .update(users)
      .set({ storageUsedBytes: Math.max(0, user.storageUsedBytes - file.sizeBytes) })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/files/[id]]", err)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
