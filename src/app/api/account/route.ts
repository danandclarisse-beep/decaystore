export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users, files, fileVersions } from "@/lib/db/schema"
import { eq, ne, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { deleteFromR2 } from "@/lib/r2"
import { z } from "zod"

// ─── PATCH /api/account — update notification preferences ─────────────────────
const prefsSchema = z.object({
  emailDigestEnabled:   z.boolean().optional(),
  decayWarningsEnabled: z.boolean().optional(),
})

export async function PATCH(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    const body = await req.json()
    const parsed = prefsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
    }

    const { emailDigestEnabled, decayWarningsEnabled } = parsed.data

    // Build update object — only include fields that were explicitly provided
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (emailDigestEnabled !== undefined)   updates.emailDigestEnabled   = emailDigestEnabled
    if (decayWarningsEnabled !== undefined) updates.decayWarningsEnabled = decayWarningsEnabled

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning()

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("[PATCH /api/account]", err)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}

// ─── DELETE /api/account — delete account and all data ────────────────────────
export async function DELETE() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    // 1. Collect all R2 keys to delete (file records + version records)
    const userFiles = await db.query.files.findMany({
      where: and(
        eq(files.userId, user.id),
        ne(files.status, "deleted"),
      ),
    })

    const allVersions = await db.query.fileVersions.findMany({
      where: eq(fileVersions.userId, user.id),
    })

    // 2. Delete from R2 (best-effort — don't fail account deletion on R2 errors)
    const r2Keys = new Set<string>()
    for (const f of userFiles)    r2Keys.add(f.r2Key)
    for (const v of allVersions)  r2Keys.add(v.r2Key)

    await Promise.allSettled(Array.from(r2Keys).map((key) => deleteFromR2(key)))

    // 3. Delete DB rows — cascades handle children (files, versions, events, keys, snapshots)
    await db.delete(users).where(eq(users.id, user.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/account]", err)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}