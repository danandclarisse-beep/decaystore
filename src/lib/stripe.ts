// ─── LemonSqueezy client (replaces stripe.ts) ────────────
// Docs: https://docs.lemonsqueezy.com/api

const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY!
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID!
const BASE = "https://api.lemonsqueezy.com/v1"

async function lsRequest(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${LS_API_KEY}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LemonSqueezy error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Plan Definitions ─────────────────────────────────────
export const PLANS = {
  free: {
    name: "Free",
    description: "Try it out",
    price: 0,
    variantId: null,
    storageGB: 1,
    decayDays: 14,
    maxFiles: 10,
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
    variantId: process.env.LEMONSQUEEZY_VARIANT_STARTER,
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
    variantId: process.env.LEMONSQUEEZY_VARIANT_PRO,
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

// ─── Create a checkout URL ────────────────────────────────
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  planKey: "starter" | "pro"
) {
  const plan = PLANS[planKey]
  if (!plan.variantId) throw new Error("No variant ID for plan: " + planKey)

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: userEmail,
          custom: { user_id: userId },
        },
        checkout_options: {
          embed: false,
        },
        product_options: {
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: LS_STORE_ID },
        },
        variant: {
          data: { type: "variants", id: plan.variantId },
        },
      },
    },
  }

  const data = await lsRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  })

  return {
    url: data.data.attributes.url as string,
  }
}

// ─── Create a customer portal URL ────────────────────────
export async function createPortalSession(customerId: string) {
  // LemonSqueezy customer portal — use the customer portal URL directly
  // The customerId here is the LemonSqueezy customer ID stored in our DB
  const data = await lsRequest(`/customers/${customerId}`)
  const portalUrl = data.data.attributes.urls?.customer_portal as string | undefined

  if (!portalUrl) {
    // Fallback: direct to LemonSqueezy app
    return { url: "https://app.lemonsqueezy.com/my-orders" }
  }

  return { url: portalUrl }
}

// ─── Verify webhook signature ─────────────────────────────
export function verifyLemonSqueezyWebhook(
  rawBody: string,
  signature: string
): boolean {
  const crypto = require("crypto")
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(rawBody)
  const digest = hmac.digest("hex")
  return digest === signature
}
