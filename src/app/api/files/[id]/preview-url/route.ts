import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { getPresignedDownloadUrl } from "@/lib/r2"

type Params = { params: { id: string } }

// ─── GET /api/files/[id]/preview-url ─────────────────────
// Returns a 60-second presigned GET URL for file preview.
// Auth + ownership gated. Does NOT reset the decay clock.
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

    // 60-second expiry — short enough to limit exposure, long enough for the browser to load
    const previewUrl = await getPresignedDownloadUrl(file.r2Key, 60)

    return NextResponse.json({ previewUrl, contentType: file.mimeType, sizeBytes: file.sizeBytes })
  } catch (err) {
    console.error("[GET /api/files/[id]/preview-url]", err)
    return NextResponse.json({ error: "Failed to generate preview URL" }, { status: 500 })
  }
}