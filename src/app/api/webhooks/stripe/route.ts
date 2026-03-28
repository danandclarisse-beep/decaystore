import { NextResponse } from "next/server"
import { verifyLemonSqueezyWebhook } from "@/lib/lemonsqueezy"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// LemonSqueezy sends all events to one endpoint
// Docs: https://docs.lemonsqueezy.com/help/webhooks
export async function POST(request: Request) {
  const rawBody  = await request.text()
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

  console.log(`[LS Webhook] Event: ${eventName}, userId: ${userId}`)

  try {
    switch (eventName) {

      // ─── New subscription created ────────────────────────
      // Fired when a recurring subscription is successfully started.
      // variant_id lives at data.attributes.variant_id.
      case "subscription_created": {
        if (!userId) {
          console.warn("[LS Webhook] subscription_created missing user_id in custom_data")
          break
        }

        const variantId      = extractVariantId(event, "subscription")
        const customerId     = String(event.data?.attributes?.customer_id ?? "")
        const subscriptionId = String(event.data?.id ?? "")
        const plan           = getPlanFromVariantId(variantId)

        if (plan === "free") {
          // variant_id didn't match either paid plan — log and skip rather than
          // downgrading the user. This prevents a bad/missing env var from
          // accidentally reverting a paying customer to free.
          console.error(
            `[LS Webhook] subscription_created: unrecognised variantId="${variantId}". ` +
            `Check LEMONSQUEEZY_VARIANT_STARTER / LEMONSQUEEZY_VARIANT_PRO env vars.`
          )
          break
        }

        const result = await db
          .update(users)
          .set({
            plan,
            billingCustomerId:     customerId,
            billingSubscriptionId: subscriptionId,
            updatedAt:             new Date(),
          })
          .where(eq(users.id, userId))
          .returning({ id: users.id })

        if (result.length === 0) {
          console.error(`[LS Webhook] subscription_created: no user row found for userId="${userId}"`)
        } else {
          console.log(`[LS Webhook] subscription_created: userId=${userId} → plan=${plan}`)
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
      // The previous code tried both but fell back to stringifying `undefined`
      // as "undefined", which never matched the env vars → plan stayed "free".
      case "order_created": {
        if (!userId) {
          console.warn("[LS Webhook] order_created missing user_id in custom_data")
          break
        }

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
          .where(eq(users.id, userId))
          .returning({ id: users.id })

        if (result.length === 0) {
          console.error(`[LS Webhook] order_created: no user row found for userId="${userId}"`)
        } else {
          console.log(`[LS Webhook] order_created: userId=${userId} → plan=${plan} (orderId=${orderId})`)
        }
        break
      }

      // ─── Subscription updated (upgrade / downgrade) ──────
      case "subscription_updated": {
        if (!userId) break

        const variantId = extractVariantId(event, "subscription")
        const status    = event.data?.attributes?.status as string
        const plan      = getPlanFromVariantId(variantId)
        const isActive  = ["active", "on_trial"].includes(status)

        if (!isActive) {
          // Not active — downgrade to free (cancelled/past_due/etc.)
          await db
            .update(users)
            .set({ plan: "free", updatedAt: new Date() })
            .where(eq(users.id, userId))
          console.log(`[LS Webhook] subscription_updated: userId=${userId} → free (status=${status})`)
          break
        }

        if (plan === "free") {
          // Active but unrecognised variant — log, don't touch the plan
          console.error(
            `[LS Webhook] subscription_updated: active but unrecognised variantId="${variantId}"`
          )
          break
        }

        await db
          .update(users)
          .set({ plan, updatedAt: new Date() })
          .where(eq(users.id, userId))
        console.log(`[LS Webhook] subscription_updated: userId=${userId} → plan=${plan}`)
        break
      }

      // ─── Subscription cancelled / expired ────────────────
      case "subscription_cancelled":
      case "subscription_expired": {
        if (!userId) break

        await db
          .update(users)
          .set({
            plan:                  "free",
            billingSubscriptionId: null,
            updatedAt:             new Date(),
          })
          .where(eq(users.id, userId))
        console.log(`[LS Webhook] ${eventName}: userId=${userId} → free`)
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
    // order_created: variant lives on the first line item, not the order root
    raw = event.data?.attributes?.first_order_item?.variant_id
  }

  if (raw === undefined || raw === null) {
    console.warn(`[LS Webhook] extractVariantId(${type}): variant_id not found in payload`)
    return ""
  }

  return String(raw)
}

// ─── Plan lookup ──────────────────────────────────────────
// Returns "free" (and logs nothing) if variantId is empty —
// callers decide whether to act on a "free" result.
function getPlanFromVariantId(variantId: string): "free" | "starter" | "pro" {
  if (!variantId) return "free"
  // String() both sides: env vars are strings, LS sends numbers — coerce to match
  if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_STARTER)) return "starter"
  if (variantId === String(process.env.LEMONSQUEEZY_VARIANT_PRO))     return "pro"
  return "free"
}