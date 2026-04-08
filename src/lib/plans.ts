// FILE: src/lib/plans.ts

// Safe to import from client components — no process.env API keys

export const PLANS = {
  free: {
    name: "Free",
    description: "Try it out",
    price: 0,
    variantId: null,
    storageGB: 1,
    decayDays: 14,
    maxFiles: 100,
    features: [
      "1 GB storage",
      "Up to 100 files",
      "14-day decay window",
      "Email warnings",
    ],
  },
  starter: {
    name: "Starter",
    description: "For individuals",
    price: 5,
    variantId: process.env.NEXT_PUBLIC_LS_VARIANT_STARTER ?? null,
    storageGB: 25,
    decayDays: 30,
    maxFiles: 500,
    features: [
      "25 GB storage",
      "Up to 500 files",
      "30-day decay window",
      "Email warnings",
      "File renewal",
      "Priority support",
    ],
  },
  pro: {
    name: "Pro",
    description: "For teams",
    price: 15,
    variantId: process.env.NEXT_PUBLIC_LS_VARIANT_PRO ?? null,
    storageGB: 100,
    decayDays: 90,
    maxFiles: 10000,
    features: [
      "100 GB storage",
      "Unlimited files",
      "90-day decay window",
      "Email warnings",
      "File renewal",
      "Custom decay rates",
      "API access",
      "Priority support",
    ],
  },
  // [P19] Trial plan — used for pricing page display and checkout routing.
  // Not a purchasable plan in the traditional sense: triggered via the
  // "Start free trial" CTA which routes to the LemonSqueezy trial variant.
  // variantId is server-only (no NEXT_PUBLIC_ prefix) — not exposed to client.
  trial: {
    name: "Pro Trial",
    description: "Full Pro, free for 14 days",
    price: 0,          // $0 today — $15/mo after 14 days
    priceAfter: 15,    // shown on pricing page as "then $15/mo"
    variantId: null,   // resolved server-side from LEMONSQUEEZY_VARIANT_PRO_TRIAL
    storageGB: 1,
    decayDays: 90,
    maxFiles: 10000,
    features: [
      "All Pro features",
      "1 GB storage cap during trial",
      "90-day decay window",
      "Custom decay rates",
      "API access",
      "No charge for 14 days",
      "Card required — cancel any time",
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

// [P18] Extended with trial plan limits.
// trial_expired is included for type safety only — uploads are blocked before
// the storage check is reached (see src/app/api/files/route.ts).
export const PLAN_STORAGE_LIMITS = {
  free:          1   * 1024 * 1024 * 1024,
  starter:       25  * 1024 * 1024 * 1024,
  pro:           100 * 1024 * 1024 * 1024,
  trial:         1   * 1024 * 1024 * 1024,  // same as free — 1 GB cap
  trial_expired: 1   * 1024 * 1024 * 1024,  // type safety only; uploads blocked separately
} as const