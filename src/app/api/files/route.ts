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
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

// [S4] Server-side MIME type allowlist.
// The client supplies contentType — we must not trust it blindly.
// Only types in this set will receive a presigned upload URL.
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/tiff", "image/avif", "image/heic",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain", "text/csv", "text/markdown",
  // Archives
  "application/zip", "application/x-tar", "application/gzip",
  "application/x-7z-compressed", "application/x-rar-compressed",
  // Audio / Video
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  // Data / Code (common formats)
  "application/json", "application/xml", "text/xml",
  // Fonts
  "font/woff", "font/woff2", "font/ttf", "font/otf",
])

// [S6] Zod schema for upload initiation — replaces ad-hoc if-checks.
const uploadSchema = z.object({
  filename:    z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes:   z.number().int().positive().max(5 * 1024 * 1024 * 1024), // 5 GB hard cap
  description: z.string().max(500).optional(),
  folderId:    z.string().uuid().optional(),
})

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

    // [S3] Rate limit: max 20 upload initiations per user per minute.
    const rl = rateLimit(clerkId, "upload", 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many upload requests. Please wait a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      )
    }

    const user = await getOrCreateUser()

    // [S6] Validate with Zod instead of manual if-checks
    const parsed = uploadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }
    const { filename, contentType, sizeBytes, description, folderId } = parsed.data

    // [S4] Reject MIME types not on the allowlist
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `File type "${contentType}" is not supported.` },
        { status: 415 }
      )
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