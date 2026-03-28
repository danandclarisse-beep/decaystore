import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { folders, files } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { z } from "zod"

type Params = { params: { id: string } }

// [P8-3] Allowed decay rate values — mirrors ALLOWED_DECAY_RATES in the files route.
const ALLOWED_DECAY_RATES = new Set([7, 14, 30, 60, 90, 180, 365])

// Zod schema for PATCH body — supports both rename and decay-rate update.
// At least one field must be present.
const patchSchema = z.object({
  name:                z.string().min(1).max(100).optional(),
  // null = revert to plan default; a number from the allowed set = custom default.
  defaultDecayRateDays: z.number().int().positive().nullable().optional(),
}).refine(
  (d) => d.name !== undefined || d.defaultDecayRateDays !== undefined,
  { message: "Provide at least one field to update (name or defaultDecayRateDays)" }
)

// ─── PATCH /api/folders/[id] — rename or set decay default ───
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const body = await request.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
    }
    const { name, defaultDecayRateDays } = parsed.data

    // [P8-3] defaultDecayRateDays is Pro-only
    if (defaultDecayRateDays !== undefined && user.plan !== "pro") {
      return NextResponse.json({ error: "Folder decay defaults require a Pro plan" }, { status: 403 })
    }
    if (
      defaultDecayRateDays !== undefined &&
      defaultDecayRateDays !== null &&
      !ALLOWED_DECAY_RATES.has(defaultDecayRateDays)
    ) {
      return NextResponse.json({ error: "Invalid decay rate. Allowed: 7, 14, 30, 60, 90, 180, 365" }, { status: 400 })
    }

    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.id, params.id), eq(folders.userId, user.id)),
    })
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    const updateSet: Partial<typeof folders.$inferInsert> = { updatedAt: new Date() }
    if (name !== undefined)                updateSet.name                = name.trim()
    if (defaultDecayRateDays !== undefined) updateSet.defaultDecayRateDays = defaultDecayRateDays

    const [updated] = await db
      .update(folders)
      .set(updateSet)
      .where(eq(folders.id, params.id))
      .returning()

    return NextResponse.json({ folder: updated })
  } catch (err) {
    console.error("[PATCH /api/folders/[id]]", err)
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 })
  }
}

// ─── DELETE /api/folders/[id] — delete folder ─────────────
// Files inside are moved to root (folderId = null), not deleted.
// Sub-folders are also moved to root. This matches industry standard
// behavior (e.g. Google Drive: deleting a folder doesn't delete contents).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    const folder = await db.query.folders.findFirst({
      where: and(eq(folders.id, params.id), eq(folders.userId, user.id)),
    })
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

    // Move files inside to root
    await db
      .update(files)
      .set({ folderId: null })
      .where(and(eq(files.folderId, params.id), eq(files.userId, user.id)))

    // Move sub-folders to root
    await db
      .update(folders)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(eq(folders.parentId, params.id), eq(folders.userId, user.id)))

    // Delete the folder itself
    await db
      .delete(folders)
      .where(and(eq(folders.id, params.id), eq(folders.userId, user.id)))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/folders/[id]]", err)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}