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
      "Up to 10 files",
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
} as const

export type PlanKey = keyof typeof PLANS

export const PLAN_STORAGE_LIMITS = {
  free: 1 * 1024 * 1024 * 1024,
  starter: 25 * 1024 * 1024 * 1024,
  pro: 100 * 1024 * 1024 * 1024,
} as const