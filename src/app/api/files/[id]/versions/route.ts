export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, fileVersions, users } from "@/lib/db/schema"
import { eq, and, ne, sql } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedUploadUrl, buildR2Key } from "@/lib/r2"
import { PLAN_STORAGE_LIMITS } from "@/lib/stripe"

type Params = { params: { id: string } }

// ─── GET /api/files/[id]/versions — list all versions ─────
export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    const versions = await db.query.fileVersions.findMany({
      where: eq(fileVersions.fileId, params.id),
      orderBy: (fileVersions, { desc }) => [desc(fileVersions.versionNumber)],
    })

    return NextResponse.json({ versions, currentVersionNumber: file.currentVersionNumber })
  } catch (err) {
    console.error("[GET /api/files/[id]/versions]", err)
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 })
  }
}

// ─── POST /api/files/[id]/versions — upload a new version ─
// Returns a presigned URL. Browser PUTs directly to R2.
// Body: { filename, contentType, sizeBytes, label? }
export async function POST(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const { filename, contentType, sizeBytes, label } = await request.json()

    if (!filename || !contentType || !sizeBytes) {
      return NextResponse.json({ error: "Missing filename, contentType, or sizeBytes" }, { status: 400 })
    }

    const file = await db.query.files.findFirst({
      where: and(eq(files.id, params.id), eq(files.userId, user.id)),
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    if (file.status === "deleted") return NextResponse.json({ error: "File is deleted" }, { status: 410 })

    // Check storage limit for the new version's size
    const storageLimit = PLAN_STORAGE_LIMITS[user.plan]
    if (user.storageUsedBytes + sizeBytes > storageLimit) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Please upgrade your plan." },
        { status: 402 }
      )
    }

    const nextVersionNumber = file.currentVersionNumber + 1
    const r2Key = buildR2Key(user.id, filename)
    const uploadUrl = await getPresignedUploadUrl(r2Key, contentType)

    // Insert the new version record
    const [newVersion] = await db
      .insert(fileVersions)
      .values({
        fileId: file.id,
        userId: user.id,
        versionNumber: nextVersionNumber,
        r2Key,
        sizeBytes,
        label: label ?? null,
      })
      .returning()

    // Update the file to point at the new version
    await db
      .update(files)
      .set({
        r2Key,
        originalFilename: filename,
        mimeType: contentType,
        sizeBytes,
        currentVersionNumber: nextVersionNumber,
        decayScore: 0,          // reset decay on new version upload
        status: "active",
        lastAccessedAt: new Date(),
      })
      .where(eq(files.id, file.id))

    // Atomic storage increment for the new version's bytes
    await db
      .update(users)
      .set({ storageUsedBytes: sql`storage_used_bytes + ${sizeBytes}` })
      .where(eq(users.id, user.id))

    return NextResponse.json({ uploadUrl, version: newVersion })
  } catch (err) {
    console.error("[POST /api/files/[id]/versions]", err)
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 })
  }
}