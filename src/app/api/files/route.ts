// Allow large file uploads — override Next.js default 4MB body limit
export const maxDuration = 60
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files, users } from "@/lib/db/schema"
import { eq, and, ne, desc } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { uploadToR2, buildR2Key } from "@/lib/r2"
import { PLAN_STORAGE_LIMITS, PLANS } from "@/lib/stripe"
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

// ─── POST /api/files — upload file via server (no browser→R2 CORS needed) ───
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    // Parse multipart form — file comes as FormData, not JSON
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const description = (formData.get("description") as string) ?? undefined

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const filename = file.name
    const contentType = file.type || "application/octet-stream"
    const sizeBytes = file.size

    if (filename.length > 255) {
      return NextResponse.json({ error: "Filename too long" }, { status: 400 })
    }
    if (sizeBytes > 5 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5 GB limit" }, { status: 400 })
    }

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

    // Upload directly from server → R2 (no browser CORS involved)
    const r2Key = buildR2Key(user.id, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, contentType)

    // Create file record in DB
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

    return NextResponse.json({ file: newFile })
  } catch (err) {
    console.error("[POST /api/files]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}