import { createHash } from "crypto"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// ─── Resolve a user row by raw API key ───────────────────
// [P5-2] Imported by middleware.ts to support Bearer token auth
// as an alternative to Clerk sessions.
// Never exported from a route file — Next.js would reject it as
// an invalid Route export field.
export async function getUserByApiKey(rawKey: string) {
  const hash = createHash("sha256").update(rawKey).digest("hex")

  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, hash),
  })

  if (!row) return null

  // Update lastUsedAt fire-and-forget — does not block the response
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {})

  return row
}