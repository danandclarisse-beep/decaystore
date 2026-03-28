import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, fileVersions, users } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
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
    if (file.status === "deleted")
      return NextResponse.json({ error: "File has been deleted" }, { status: 410 })

    // Update last accessed timestamp (resets decay)
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

// ─── PATCH /api/files/[id] — renew file or update metadata ──
// Accepts an optional JSON body. If { isPublic: boolean } is present,
// toggles the public flag (Pro only). Otherwise performs a standard renewal.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    // Check for a JSON body — tolerates empty bodies (plain renewal)
    let body: Record<string, unknown> = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { /* no body or non-JSON — treat as plain renew */ }

    // ── [P7-3] isPublic toggle ─────────────────────────────
    if (typeof body.isPublic === "boolean") {
      if (user.plan !== "pro")
        return NextResponse.json({ error: "Pro plan required to share files publicly" }, { status: 403 })

      const file = await db.query.files.findFirst({
        where: and(eq(files.id, params.id), eq(files.userId, user.id)),
      })
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

      await db.update(files).set({ isPublic: body.isPublic }).where(eq(files.id, file.id))
      return NextResponse.json({ success: true, isPublic: body.isPublic })
    }

    // ── Default: renew ─────────────────────────────────────
    const result = await renewFile(params.id, user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[PATCH /api/files/[id]]", err)
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 })
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
    if (file.status === "deleted") return NextResponse.json({ success: true })

    // [P1-2] Fetch all version records so we can purge every R2 object,
    // not just the current version's r2Key. Versions that were superseded
    // would otherwise be orphaned in R2 forever.
    const versions = await db.query.fileVersions.findMany({
      where: eq(fileVersions.fileId, file.id),
    })

    // Delete every R2 object. If any deletion fails we bail before touching
    // the DB, so the user can safely retry and no DB record is left dangling.
    const keysToDelete = [
      file.r2Key,
      ...versions.map((v) => v.r2Key).filter((k) => k !== file.r2Key),
    ]
    for (const key of keysToDelete) {
      await deleteFromR2(key)
    }

    // Remove all version DB records
    await db.delete(fileVersions).where(eq(fileVersions.fileId, file.id))

    // Mark the file as deleted in DB
    await db
      .update(files)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(files.id, file.id))

    // Atomic decrement using the file's current sizeBytes.
    // Floors at 0 to guard against any prior accounting drift.
    await db
      .update(users)
      .set({ storageUsedBytes: sql`GREATEST(0, storage_used_bytes - ${file.sizeBytes})` })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/files/[id]]", err)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}