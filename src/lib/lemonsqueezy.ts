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

// ─── Plan Definitions (single source of truth in plans.ts) ──
// [P2-2] Import from plans.ts rather than re-declaring here.
import { PLANS } from "@/lib/plans"
export { PLANS, PLAN_STORAGE_LIMITS } from "@/lib/plans"
export type { PlanKey } from "@/lib/plans"

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