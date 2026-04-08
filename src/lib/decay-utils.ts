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
  free:          14,
  starter:       30,
  pro:           90,
  trial:         90,  // [FIX] Trial users get Pro-equivalent decay rate
  trial_expired: 90,  // Keeps type safety for expired trial files already in DB
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
  if (score < 0.25) return "#10b981"
  if (score < 0.5) return "#84cc16"
  if (score < 0.75) return "#14b8a6"
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

// ─── Human-readable time until deletion (days + hours) ───
export function getTimeUntilDeletion(
  lastAccessedAt: Date,
  decayRateDays: number
): string {
  const score = calculateDecayScore(lastAccessedAt, decayRateDays)
  const remainingMs = Math.max(0, (1 - score) * decayRateDays * 24 * 60 * 60 * 1000)
  const totalHours = Math.floor(remainingMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days === 0 && hours === 0) return "< 1h"
  if (days === 0) return `${hours}h`
  if (hours === 0) return `${days}d`
  return `${days}d ${hours}h`
}