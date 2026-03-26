export const maxDuration = 60
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, fileVersions, users } from "@/lib/db/schema"
import { eq, and, ne, desc, sql, count } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedUploadUrl, buildR2Key } from "@/lib/r2"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/plans"
import { PLAN_DECAY_RATES } from "@/lib/decay"

// ─── GET /api/files — list user's files ───────────────────
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const userFiles = await db.query.files.findMany({
      where: and(eq(files.userId, user.id), ne(files.status, "deleted")),
      orderBy: [desc(files.uploadedAt)],
    })

    return NextResponse.json({ files: userFiles, user })
  } catch (err) {
    console.error("[GET /api/files]", err)
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 })
  }
}

// ─── POST /api/files — generate presigned upload URL ──────
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const { filename, contentType, sizeBytes, description, folderId } = await request.json()

    if (!filename || !contentType || !sizeBytes) {
      return NextResponse.json({ error: "Missing filename, contentType, or sizeBytes" }, { status: 400 })
    }
    if (filename.length > 255) {
      return NextResponse.json({ error: "Filename too long" }, { status: 400 })
    }
    if (sizeBytes > 5 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5 GB limit" }, { status: 400 })
    }

    // Validate folderId belongs to this user if provided
    if (folderId) {
      const { folders } = await import("@/lib/db/schema")
      const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, user.id)),
      })
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    // Check storage limit
    const storageLimit = PLAN_STORAGE_LIMITS[user.plan]
    if (user.storageUsedBytes + sizeBytes > storageLimit) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Please upgrade your plan." },
        { status: 402 }
      )
    }

    // [P3-2] Check file count limit using COUNT(*) instead of loading all rows
    const plan = PLANS[user.plan]
    const [{ fileCount }] = await db
      .select({ fileCount: count() })
      .from(files)
      .where(and(eq(files.userId, user.id), ne(files.status, "deleted")))
    if (fileCount >= plan.maxFiles) {
      return NextResponse.json(
        { error: `File limit reached (${plan.maxFiles} files on ${plan.name} plan).` },
        { status: 402 }
      )
    }

    // Generate presigned URL
    const r2Key    = buildR2Key(user.id, filename)
    const uploadUrl = await getPresignedUploadUrl(r2Key, contentType)

    // Insert file record
    const decayRateDays = PLAN_DECAY_RATES[user.plan]
    const [newFile] = await db
      .insert(files)
      .values({
        userId: user.id,
        folderId: folderId ?? null,
        r2Key,
        filename: r2Key,
        originalFilename: filename,
        mimeType: contentType,
        sizeBytes,
        decayRateDays,
        description,
        status: "active",
        decayScore: 0,
        currentVersionNumber: 1,
      })
      .returning()

    // Seed version 1 record
    await db.insert(fileVersions).values({
      fileId: newFile.id,
      userId: user.id,
      versionNumber: 1,
      r2Key,
      sizeBytes,
    })

    // Atomic storage increment
    await db
      .update(users)
      .set({ storageUsedBytes: sql`storage_used_bytes + ${sizeBytes}` })
      .where(eq(users.id, user.id))

    return NextResponse.json({ uploadUrl, file: newFile })
  } catch (err) {
    console.error("[POST /api/files]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}