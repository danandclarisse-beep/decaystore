export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { users, files, fileVersions } from "@/lib/db/schema"
import { eq, ne, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { deleteFromR2 } from "@/lib/r2"
import { rateLimit } from "@/lib/rate-limit"
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

    // [P13-3] Rate-limit preference updates — consistent with all other mutating endpoints
    const rl = rateLimit(clerkId, "account-patch", 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

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

export async function DELETE() {
  try {
    const { userId: clerkId, sessionId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const cookieStore = await cookies()
    const user = await getOrCreateUser()

    // ── Step 1: Invalidate Clerk session + delete Clerk user FIRST ───────────
    // Deleting the Clerk user before the DB row ensures the JWT is immediately
    // rejected by Clerk's servers. If we delete DB first, there's a window where
    // the Clerk session is still valid and the middleware re-authenticates the
    // user, finding no DB row and silently re-creating the session.
    const clerk = await clerkClient()
    try {
      if (sessionId) await clerk.sessions.revokeSession(sessionId)
    } catch (err) {
      console.error("[DELETE /api/account] Session revocation failed:", err)
    }
    try {
      await clerk.users.deleteUser(clerkId)
    } catch (err) {
      console.error("[DELETE /api/account] Clerk user deletion failed:", err)
    }

    // ── Step 2: R2 + DB cleanup (fire-and-forget safe — Clerk is already gone) ─
    const userFiles = await db.query.files.findMany({
      where: and(eq(files.userId, user.id), ne(files.status, "deleted")),
    })
    const allVersions = await db.query.fileVersions.findMany({
      where: eq(fileVersions.userId, user.id),
    })
    const r2Keys = new Set<string>()
    for (const f of userFiles)   r2Keys.add(f.r2Key)
    for (const v of allVersions) r2Keys.add(v.r2Key)
    await Promise.allSettled(Array.from(r2Keys).map((key) => deleteFromR2(key)))
    await db.delete(users).where(eq(users.id, user.id))

    // ── Step 3: Expire all Clerk cookies on the response ─────────────────────
    // Belt-and-suspenders: even though the Clerk user is gone, clearing cookies
    // prevents the browser from sending stale tokens on the next request.
    const response = NextResponse.json({ ok: true })
    const allCookies = cookieStore.getAll()
    const clerkCookiePatterns = [
      "__session", "__client_uat", "__refresh",
      "__clerk_db_jwt", "clerk_active_context",
    ]
    for (const cookie of allCookies) {
      const isClerkCookie = clerkCookiePatterns.some(pattern =>
        cookie.name === pattern || cookie.name.startsWith(`${pattern}_`)
      )
      if (isClerkCookie) {
        response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" })
      }
    }

    return response
  } catch (err) {
    console.error("[DELETE /api/account]", err)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}