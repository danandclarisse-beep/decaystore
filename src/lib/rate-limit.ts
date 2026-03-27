// ─── Simple server-side rate limiter ─────────────────────
// [S3] Prevents abuse on upload initiation and checkout endpoints.
//
// Uses an in-memory sliding-window counter keyed by userId.
// This is intentionally simple: it works correctly within a single
// serverless function instance. Vercel may spawn multiple instances
// under load, so this is a best-effort control, not a hard guarantee.
// For a stricter guarantee, swap the Map for Upstash Redis.
//
// Usage:
//   const result = rateLimit(userId, "upload", 10, 60_000)
//   if (!result.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

/**
 * Check and increment the rate-limit counter for a given key.
 *
 * @param identifier  Unique string for this caller (e.g. userId)
 * @param action      Bucket name so different limits don't collide (e.g. "upload")
 * @param limit       Max requests allowed within the window
 * @param windowMs    Window duration in milliseconds
 * @returns { ok: boolean, remaining: number, resetAt: number }
 */
export function rateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetAt: number } {
  const key = `${action}:${identifier}`
  const now = Date.now()

  let win = store.get(key)

  // Start a fresh window if none exists or the previous one has expired
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++

  const ok = win.count <= limit
  const remaining = Math.max(0, limit - win.count)

  return { ok, remaining, resetAt: win.resetAt }
}