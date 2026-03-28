import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { z } from "zod"

// Max API keys per Pro user
const MAX_KEYS = 10

const createKeySchema = z.object({
  label: z.string().min(1, "Label is required").max(64, "Label too long").trim(),
})

// ─── GET /api/keys — list keys for the current user ──────
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    if (user.plan !== "pro") {
      return NextResponse.json({ error: "API access is available on the Pro plan only." }, { status: 403 })
    }

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, user.id),
      orderBy: (k, { desc }) => [desc(k.createdAt)],
    })

    // Never return keyHash — only safe display fields
    return NextResponse.json({
      keys: keys.map((k) => ({
        id:         k.id,
        label:      k.label,
        keyPrefix:  k.keyPrefix,
        lastUsedAt: k.lastUsedAt,
        createdAt:  k.createdAt,
      })),
    })
  } catch (err) {
    console.error("[GET /api/keys]", err)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

// ─── POST /api/keys — create a new key ───────────────────
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()
    if (user.plan !== "pro") {
      return NextResponse.json({ error: "API access is available on the Pro plan only." }, { status: 403 })
    }

    const parsed = createKeySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }

    // Enforce per-user key limit
    const existing = await db.query.apiKeys.findMany({ where: eq(apiKeys.userId, user.id) })
    if (existing.length >= MAX_KEYS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_KEYS} API keys allowed. Delete an existing key first.` },
        { status: 400 }
      )
    }

    // Generate a secure random key: "dsk_" prefix + 32 random bytes as hex = 68 chars total
    const rawKey   = `dsk_${randomBytes(32).toString("hex")}`
    const keyHash  = createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 12) // "dsk_" + 8 chars shown in UI

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        userId:    user.id,
        label:     parsed.data.label,
        keyHash,
        keyPrefix,
      })
      .returning()

    // Return the raw key ONCE — it is never stored and cannot be recovered
    return NextResponse.json({
      key: {
        id:        newKey.id,
        label:     newKey.label,
        keyPrefix: newKey.keyPrefix,
        createdAt: newKey.createdAt,
        // rawKey shown only on creation — never returned again
        rawKey,
      },
    }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/keys]", err)
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
  }
}

// ─── DELETE /api/keys?id=<keyId> — revoke a key ──────────
export async function DELETE(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user  = await getOrCreateUser()
    const keyId = new URL(request.url).searchParams.get("id")
    if (!keyId) return NextResponse.json({ error: "Key ID required" }, { status: 400 })

    const deleted = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/keys]", err)
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 })
  }
}