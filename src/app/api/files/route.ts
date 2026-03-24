import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, users } from "@/lib/db/schema"
import { eq, and, ne, desc } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedUploadUrl, buildR2Key } from "@/lib/r2"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/stripe"
import { PLAN_DECAY_RATES } from "@/lib/decay"
import { z } from "zod"

// ─── GET /api/files — list user's files ───────────────────
export async function GET() {
  try {
    const { userId: clerkId } = auth()
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

// ─── POST /api/files — request presigned upload URL ───────
const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().positive().max(5 * 1024 * 1024 * 1024), // 5GB max per file
  description: z.string().max(500).optional(),
})

export async function POST(request: Request) {
  try {
    const { userId: clerkId } = auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const body = await request.json()
    const parsed = uploadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 })
    }

    const { filename, contentType, sizeBytes, description } = parsed.data

    // Check storage limit
    const storageLimit = PLAN_STORAGE_LIMITS[user.plan]
    if (user.storageUsedBytes + sizeBytes > storageLimit) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Please upgrade your plan." },
        { status: 402 }
      )
    }

    // Check file count limit
    const plan = PLANS[user.plan]
    const existingCount = await db.query.files.findMany({
      where: and(eq(files.userId, user.id), ne(files.status, "deleted")),
    })
    if (existingCount.length >= plan.maxFiles) {
      return NextResponse.json(
        { error: `File limit reached (${plan.maxFiles} files on ${plan.name} plan).` },
        { status: 402 }
      )
    }

    // Build R2 key and get presigned URL
    const r2Key = buildR2Key(user.id, filename)
    const presignedUrl = await getPresignedUploadUrl(r2Key, contentType)

    // Create file record in DB (status pending until confirmed)
    const decayRateDays = PLAN_DECAY_RATES[user.plan]
    const [newFile] = await db
      .insert(files)
      .values({
        userId: user.id,
        r2Key,
        filename: r2Key,
        originalFilename: filename,
        mimeType: contentType,
        sizeBytes,
        decayRateDays,
        description,
        status: "active",
        decayScore: 0,
      })
      .returning()

    // Update user storage usage
    await db
      .update(users)
      .set({ storageUsedBytes: user.storageUsedBytes + sizeBytes })
      .where(eq(users.id, user.id))

    return NextResponse.json({ presignedUrl, file: newFile })
  } catch (err) {
    console.error("[POST /api/files]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
