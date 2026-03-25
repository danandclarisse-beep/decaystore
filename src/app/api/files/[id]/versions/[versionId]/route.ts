import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, fileVersions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedDownloadUrl } from "@/lib/r2"

type Params = { params: { id: string; versionId: string } }

// ─── GET /api/files/[id]/versions/[versionId] ─────────────
// Returns a presigned download URL for a specific version.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    // Verify the file belongs to this user
    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Fetch the specific version
    const version = await db.query.fileVersions.findFirst({
      where: and(
        eq(fileVersions.id, params.versionId),
        eq(fileVersions.fileId, params.id)
      ),
    })
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    const downloadUrl = await getPresignedDownloadUrl(version.r2Key)

    return NextResponse.json({ downloadUrl, version })
  } catch (err) {
    console.error("[GET /api/files/[id]/versions/[versionId]]", err)
    return NextResponse.json({ error: "Failed to get version download URL" }, { status: 500 })
  }
}

// ─── DELETE /api/files/[id]/versions/[versionId] ──────────
// Delete a specific old version. Cannot delete the current version.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    const version = await db.query.fileVersions.findFirst({
      where: and(
        eq(fileVersions.id, params.versionId),
        eq(fileVersions.fileId, params.id)
      ),
    })
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    // Cannot delete the current version
    if (version.versionNumber === file.currentVersionNumber) {
      return NextResponse.json(
        { error: "Cannot delete the current version. Upload a new version first." },
        { status: 400 }
      )
    }

    // Delete from R2
    const { deleteFromR2 } = await import("@/lib/r2")
    await deleteFromR2(version.r2Key)

    // Delete version record
    await db.delete(fileVersions).where(eq(fileVersions.id, params.versionId))

    // Decrement storage atomically
    const { sql } = await import("drizzle-orm")
    const { users } = await import("@/lib/db/schema")
    await db
      .update(users)
      .set({ storageUsedBytes: sql`GREATEST(0, storage_used_bytes - ${version.sizeBytes})` })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/files/[id]/versions/[versionId]]", err)
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 })
  }
}