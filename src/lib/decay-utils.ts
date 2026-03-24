// ─── CLIENT-SAFE decay utilities ─────────────────────────
// This file has NO server-only imports (no db, no r2, no email).
// It is safe to import from "use client" components.

// ─── Thresholds ───────────────────────────────────────────
export const DECAY_THRESHOLDS = {
  WARN: 0.5,       // 50% decayed → email warning
  COMPRESS: 0.75,  // 75% decayed → mark as compressed
  CRITICAL: 0.9,   // 90% → final warning email
  DELETE: 1.0,     // 100% → delete permanently
} as const

// ─── Per-plan decay rates (days until fully decayed) ──────
export const PLAN_DECAY_RATES = {
  free: 14,
  starter: 30,
  pro: 90,
} as const

// ─── Calculate current decay score ────────────────────────
export function calculateDecayScore(
  lastAccessedAt: Date,
  decayRateDays: number
): number {
  const now = Date.now()
  const lastAccess = lastAccessedAt.getTime()
  const msSinceAccess = now - lastAccess
  const daysSinceAccess = msSinceAccess / (1000 * 60 * 60 * 24)
  const score = daysSinceAccess / decayRateDays
  return Math.min(score, 1.0)
}

// ─── Get decay color for UI ───────────────────────────────
export function getDecayColor(score: number): string {
  if (score < 0.25) return "#22c55e"
  if (score < 0.5) return "#84cc16"
  if (score < 0.75) return "#eab308"
  if (score < 0.9) return "#f97316"
  return "#ef4444"
}

// ─── Get decay label for UI ───────────────────────────────
export function getDecayLabel(score: number): string {
  if (score < 0.25) return "Fresh"
  if (score < 0.5) return "Aging"
  if (score < 0.75) return "Stale"
  if (score < 0.9) return "Critical"
  return "Expiring"
}

// ─── Days until deletion ──────────────────────────────────
export function getDaysUntilDeletion(
  lastAccessedAt: Date,
  decayRateDays: number
): number {
  const score = calculateDecayScore(lastAccessedAt, decayRateDays)
  const remaining = (1 - score) * decayRateDays
  return Math.max(0, Math.floor(remaining))
}