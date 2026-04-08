// ROUTE: POST /api/webhooks/stripe
// FILE:  src/app/api/webhooks/stripe/route.ts

import { NextResponse } from "next/server"
import { verifyLemonSqueezyWebhook } from "@/lib/lemonsqueezy"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// LemonSqueezy sends all events to one endpoint
// Docs: https://docs.lemonsqueezy.com/help/webhooks
export async function POST(request: Request) {
  const rawBody   = await request.text()
  const signature = request.headers.get("x-signature") ?? ""

  // Verify the webhook is genuinely from LemonSqueezy
  if (!verifyLemonSqueezyWebhook(rawBody, signature)) {
    console.error("[LS Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventName  = event.meta?.event_name as string
  const customData = event.meta?.custom_data as Record<string, string> | undefined
  const userId     = customData?.user_id

  console.log(`[LS Webhook] Event: ${eventName}, userId: ${userId ?? "(missing — will attempt customer fallback)"}`)

  try {
    switch (eventName) {

      // ─── New subscription created ────────────────────────
      // Fired when a recurring subscription is successfully started.
      // variant_id lives at data.attributes.variant_id.
      // [P18] Detects trial variant → sets plan = 'trial', writes trial_ends_at
      // [FIX] When custom_data.user_id is absent (LemonSqueezy drops it on some
      //       redirect-mode checkouts), fall back to a billingCustomerId lookup
      //       so the plan is always applied after a successful trial checkout.
      case "subscription_created": {
        const variantId      = extractVariantId(event, "subscription")
        const customerId     = String(event.data?.attributes?.customer_id ?? "")
        const subscriptionId = String(event.data?.id ?? "")
        const plan           = getPlanFromVariantId(variantId)

        if (plan === "free") {
          console.error(
            `[LS Webhook] subscription_created: unrecognised variantId="${variantId}". ` +
            `Check LEMONSQUEEZY_VARIANT_STARTER / LEMONSQUEEZY_VARIANT_PRO / LEMONSQUEEZY_VARIANT_PRO_TRIAL env vars.`
          )
          break
        }

        // [FIX] Resolve the internal user ID:
        //   1. Prefer custom_data.user_id (the DB uuid embedded at checkout).
        //   2. Fall back to looking up by billing_customer_id — handles the case
        //      where LemonSqueezy silently drops custom_data in redirect-mode flows.
        let targetUserId = userId
        if (!targetUserId && customerId) {
          const found = await db.query.users.findFirst({
            where: eq(users.billingCustomerId, customerId),
          })
          if (found) {
            targetUserId = found.id
            console.log(`[LS Webhook] subscription_created: resolved userId=${targetUserId} via billingCustomerId fallback`)
          }
        }

        if (!targetUserId) {
          console.error(
            `[LS Webhook] subscription_created: cannot resolve user — ` +
            `custom_data.user_id is absent and no row matches billingCustomerId="${customerId}". ` +
            `Plan "${plan}" was NOT applied.`
          )
          break
        }

        // [P18] Set trial_ends_at for trial plan
        const isTrial     = plan === "trial"
        const trialEndsAt = isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null

        const result = await db
          .update(users)
          .set({
            plan,
            billingCustomerId:     customerId,
            billingSubscriptionId: subscriptionId,
            trialEndsAt,
            updatedAt:             new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning({ id: users.id })

        if (result.length === 0) {
          console.error(`[LS Webhook] subscription_created: no user row found for userId="${targetUserId}"`)
        } else {
          console.log(`[LS Webhook] subscription_created: userId=${targetUserId} → plan=${plan}${isTrial ? ` trialEndsAt=${trialEndsAt}` : ""}`)
        }
        break
      }

      // ─── One-time order created ───────────────────────────
      // Fired on every successful payment (including the first payment of a
      // subscription). For subscriptions the plan is already set by
      // subscription_created, so we only use order_created as a fallback when
      // no subscription event fires (e.g. one-time purchases, or test checkouts
      // that skip subscription_created).
      //
      // BUG FIX: variant_id is NOT at data.attributes.variant_id for orders —
      // it is at data.attributes.first_order_item.variant_id.
      //
      // [FIX] Same billingCustomerId fallback as subscription_created.
      case "order_created": {
        const variantId  = extractVariantId(event, "order")
        const customerId = String(event.data?.attributes?.customer_id ?? "")
        const orderId    = String(event.data?.id ?? "")
        const plan       = getPlanFromVariantId(variantId)

        if (plan === "free") {
          console.error(
            `[LS Webhook] order_created: unrecognised variantId="${variantId}". ` +
            `Check LEMONSQUEEZY_VARIANT_STARTER / LEMONSQUEEZY_VARIANT_PRO env vars.`
          )
          break
        }

        // [FIX] Resolve user — prefer custom_data.user_id, fall back to billingCustomerId
        let targetUserId = userId
        if (!targetUserId && customerId) {
          const found = await db.query.users.findFirst({
            where: eq(users.billingCustomerId, customerId),
          })
          if (found) {
            targetUserId = found.id
            console.log(`[LS Webhook] order_created: resolved userId=${targetUserId} via billingCustomerId fallback`)
          }
        }

        if (!targetUserId) {
          console.error(
            `[LS Webhook] order_created: cannot resolve user — ` +
            `custom_data.user_id is absent and no row matches billingCustomerId="${customerId}". ` +
            `Plan "${plan}" was NOT applied.`
          )
          break
        }

        // Only set billingCustomerId from order_created — do NOT overwrite
        // billingSubscriptionId here, because subscription_created will set it
        // to the correct subscription ID. Overwriting it with the order ID would
        // break the billing portal lookup.
        const result = await db
          .update(users)
          .set({
            plan,
            billingCustomerId: customerId,
            updatedAt:         new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning({ id: users.id })

        if (result.length === 0) {
          console.error(`[LS Webhook] order_created: no user row found for userId="${targetUserId}"`)
        } else {
          console.log(`[LS Webhook] order_created: userId=${targetUserId} → plan=${plan} (orderId=${orderId})`)
        }
        break
      }

      // ─── Subscription updated (upgrade / downgrade) ──────
      // [P18] Detects trial-to-active transition → sets plan = 'pro', clears trial_ends_at
      // [FIX] Same billingCustomerId fallback for userId resolution.
      case "subscription_updated": {
        const variantId  = extractVariantId(event, "subscription")
        const customerId = String(event.data?.attributes?.customer_id ?? "")
        const status     = event.data?.attributes?.status as string
        const plan       = getPlanFromVariantId(variantId)
        const isActive   = ["active", "on_trial"].includes(status)

        // [FIX] Resolve user — prefer custom_data.user_id, fall back to billingCustomerId
        let targetUserId = userId
        if (!targetUserId && customerId) {
          const found = await db.query.users.findFirst({
            where: eq(users.billingCustomerId, customerId),
          })
          if (found) {
            targetUserId = found.id
            console.log(`[LS Webhook] subscription_updated: resolved userId=${targetUserId} via billingCustomerId fallback`)
          }
        }

        if (!targetUserId) {
          console.warn(`[LS Webhook] subscription_updated: cannot resolve user — skipping`)
          break
        }

        if (!isActive) {
          // Not active — downgrade to free (cancelled/past_due/etc.)
          await db
            .update(users)
            .set({ plan: "free", updatedAt: new Date() })
            .where(eq(users.id, targetUserId))
          console.log(`[LS Webhook] subscription_updated: userId=${targetUserId} → free (status=${status})`)
          break
        }

        if (plan === "free") {
          console.error(
            `[LS Webhook] subscription_updated: active but unrecognised variantId="${variantId}"`
          )
          break
        }

        // [P18] When the trial variant fires with status=active, the user has converted to Pro.
        // LemonSqueezy sends the trial variant ID even after conversion, so we map it to 'pro'.
        const planToSet    = (plan === "trial" && status === "active") ? "pro" : plan
        const clearTrialAt = planToSet === "pro" ? null : undefined

        await db
          .update(users)
          .set({ plan: planToSet, trialEndsAt: clearTrialAt, updatedAt: new Date() })
          .where(eq(users.id, targetUserId))
        console.log(`[LS Webhook] subscription_updated: userId=${targetUserId} → plan=${planToSet}`)
        break
      }

      // ─── Subscription cancelled / expired ────────────────
      // [P18] Trial cancellations are handled by the /api/cron/trial-expiry cron —
      // do NOT immediately drop trial users to free here. They retain trial access
      // until trial_ends_at, at which point the cron transitions them to trial_expired.
      // [FIX] Same billingCustomerId fallback for userId resolution.
      case "subscription_cancelled":
      case "subscription_expired": {
        const customerId = String(event.data?.attributes?.customer_id ?? "")

        // [FIX] Resolve user — prefer custom_data.user_id, fall back to billingCustomerId
        let targetUserId = userId
        if (!targetUserId && customerId) {
          const found = await db.query.users.findFirst({
            where: eq(users.billingCustomerId, customerId),
          })
          if (found) {
            targetUserId = found.id
            console.log(`[LS Webhook] ${eventName}: resolved userId=${targetUserId} via billingCustomerId fallback`)
          }
        }

        if (!targetUserId) {
          console.warn(`[LS Webhook] ${eventName}: cannot resolve user — skipping`)
          break
        }

        // Fetch current plan before updating so we can skip trial users
        const [currentUser] = await db
          .select({ plan: users.plan })
          .from(users)
          .where(eq(users.id, targetUserId))

        if (currentUser?.plan === "trial") {
          // Leave trial users alone — the trial-expiry cron owns their lifecycle
          console.log(`[LS Webhook] ${eventName}: userId=${targetUserId} is on trial — skipping (cron will handle)`)
          break
        }

        await db
          .update(users)
          .set({
            plan:                  "free",
            billingSubscriptionId: null,
            updatedAt:             new Date(),
          })
          .where(eq(users.id, targetUserId))
        console.log(`[LS Webhook] ${eventName}: userId=${targetUserId} → free`)
        break
      }

      default:
        console.log(`[LS Webhook] Unhandled event: ${eventName}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[LS Webhook] Handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

// ─── Variant ID extraction ────────────────────────────────
// LemonSqueezy puts variant_id in different places depending on the object type:
//
//   subscription events → data.attributes.variant_id                    (number)
//   order events        → data.attributes.first_order_item.variant_id   (number)
//
// We stringify to compare against env var strings, but we guard against
// undefined/null first so we never produce the misleading string "undefined".
function extractVariantId(event: any, type: "subscription" | "order"): string {
  let raw: unknown

  if (type === "subscription") {
    raw = event.data?.attributes?.variant_id
  } else {
    raw = event.data?.attributes?.first_order_item?.variant_id
  }

  if (raw === undefined || raw === null) {
    console.warn(`[LS Webhook] extractVariantId(${type}): variant_id not found in payload`)
    return ""
  }

  return String(raw)
}

// ─── Plan lookup ──────────────────────────────────────────
// [P18] Added 'trial' return value for LEMONSQUEEZY_VARIANT_PRO_TRIAL.
// Returns "free" (and logs nothing) if variantId is empty —
// callers decide whether to act on a "free" result.
function getPlanFromVariantId(variantId: string): "free" | "starter" | "pro" | "trial" {
  console.log(`[LS Webhook] getPlanFromVariantId: input="${variantId}" STARTER="${process.env.LEMONSQUEEZY_VARIANT_STARTER}" PRO="${process.env.LEMONSQUEEZY_VARIANT_PRO}" TRIAL="${process.env.LEMONSQUEEZY_VARIANT_PRO_TRIAL}"`)
  if (!variantId) return "free"
  if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_STARTER))   return "starter"
  if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_PRO))       return "pro"
  if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_PRO_TRIAL)) return "trial"
  return "free"
}