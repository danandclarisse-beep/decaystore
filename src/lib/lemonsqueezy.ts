// FILE: src/lib/lemonsqueezy.ts

// ─── LemonSqueezy client (replaces stripe.ts) ────────────
// Docs: https://docs.lemonsqueezy.com/api
import { createHmac, timingSafeEqual } from "crypto"

const LS_API_KEY  = process.env.LEMONSQUEEZY_API_KEY!
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID!
const BASE        = "https://api.lemonsqueezy.com/v1"

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
// [P18] Added "trial" planKey — routes to LEMONSQUEEZY_VARIANT_PRO_TRIAL.
// [FIX] Added console.log to confirm custom_data.user_id is embedded at checkout
//       creation time. If the webhook later receives no user_id, it means
//       LemonSqueezy is dropping custom_data in the redirect flow — the webhook
//       handler's billingCustomerId fallback will recover from this automatically.
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  planKey: "starter" | "pro" | "trial"
) {
  let variantId: string | null

  if (planKey === "trial") {
    variantId = process.env.LEMONSQUEEZY_VARIANT_PRO_TRIAL ?? null
  } else {
    variantId = PLANS[planKey].variantId
  }

  if (!variantId) throw new Error("No variant ID for plan: " + planKey)

  // [FIX] Log that we are embedding the user_id so we can cross-reference
  // against webhook logs if a plan is not applied after checkout.
  console.log(`[LS Checkout] Creating checkout for userId="${userId}" plan="${planKey}" variantId="${variantId}"`)

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: userEmail,
          // custom_data.user_id is the internal DB uuid.
          // The webhook handler reads this from event.meta.custom_data.user_id
          // and uses it to locate the user row for the plan update.
          // If LemonSqueezy drops this in redirect mode, the webhook falls back
          // to a billingCustomerId lookup — see src/app/api/webhooks/stripe/route.ts.
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
          data: { type: "variants", id: variantId },
        },
      },
    },
  }

  const data = await lsRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  })

  const url = data.data.attributes.url as string
  console.log(`[LS Checkout] Checkout URL created for userId="${userId}" plan="${planKey}"`)

  return { url }
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
// [S1] Uses timingSafeEqual to prevent timing-based signature forgery.
// [S7] crypto imported at the top of the file (ESM-safe, no require()).
export function verifyLemonSqueezyWebhook(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!
  const digest = createHmac("sha256", secret).update(rawBody).digest()
  let sig: Buffer
  try {
    sig = Buffer.from(signature, "hex")
  } catch {
    return false
  }
  // Buffers must be the same length before timingSafeEqual — otherwise it throws.
  return sig.length === digest.length && timingSafeEqual(digest, sig)
}