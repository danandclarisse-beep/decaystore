export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { folders } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { z } from "zod"

// [S6] Zod schema for folder creation — replaces manual if-checks
const createFolderSchema = z.object({
  name:     z.string().min(1, "Folder name is required").max(100, "Folder name too long (max 100 chars)").trim(),
  parentId: z.string().uuid().optional(),
})

// ─── GET /api/folders — list all folders for user ─────────
export async function GET(_request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const allFolders = await db.query.folders.findMany({
      where: eq(folders.userId, user.id),
      orderBy: (folders, { asc }) => [asc(folders.name)],
    })

    return NextResponse.json({ folders: allFolders })
  } catch (err) {
    console.error("[GET /api/folders]", err)
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 })
  }
}

// ─── POST /api/folders — create folder ────────────────────
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const parsed = createFolderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }
    const { name, parentId } = parsed.data

    // If parentId provided, verify it belongs to this user
    if (parentId) {
      const parent = await db.query.folders.findFirst({
        where: and(eq(folders.id, parentId), eq(folders.userId, user.id)),
      })
      if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 })
    }

    const [newFolder] = await db
      .insert(folders)
      .values({
        userId: user.id,
        parentId: parentId ?? null,
        name,
      })
      .returning()

    return NextResponse.json({ folder: newFolder })
  } catch (err) {
    console.error("[POST /api/folders]", err)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}