export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { folders } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"

// ─── GET /api/folders — list all folders for user ─────────
export async function GET(request: Request) {
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
    const { name, parentId } = await request.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Folder name too long (max 100 chars)" }, { status: 400 })
    }

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
        name: name.trim(),
      })
      .returning()

    return NextResponse.json({ folder: newFolder })
  } catch (err) {
    console.error("[POST /api/folders]", err)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}