import { NextResponse } from "next/server"
import { verifyLemonSqueezyWebhook } from "@/lib/lemonsqueezy"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// LemonSqueezy sends all events to one endpoint
// Docs: https://docs.lemonsqueezy.com/help/webhooks
export async function POST(request: Request) {
  const rawBody = await request.text()
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

  const eventName = event.meta?.event_name as string
  const customData = event.meta?.custom_data as Record<string, string> | undefined
  const userId = customData?.user_id

  console.log(`[LS Webhook] Event: ${eventName}, userId: ${userId}`)

  try {
    switch (eventName) {
      // ─── Subscription created / payment succeeds ────────
      case "subscription_created":
      case "order_created": {
        if (!userId) break

        const variantId = String(
          event.data?.attributes?.variant_id ??
          event.data?.attributes?.first_order_item?.variant_id
        )
        const customerId = String(event.data?.attributes?.customer_id)
        const subscriptionId = String(event.data?.id)
        const plan = getPlanFromVariantId(variantId)

        await db
          .update(users)
          .set({
            plan,
            billingCustomerId: customerId,       // reusing billingCustomerId field for LS customer ID
            billingSubscriptionId: subscriptionId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))

        break
      }

      // ─── Subscription updated (upgrade / downgrade) ─────
      case "subscription_updated": {
        if (!userId) break

        const variantId = String(event.data?.attributes?.variant_id)
        const status = event.data?.attributes?.status as string
        const plan = getPlanFromVariantId(variantId)
        const isActive = ["active", "on_trial"].includes(status)

        await db
          .update(users)
          .set({
            plan: isActive ? plan : "free",
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))

        break
      }

      // ─── Subscription cancelled / expired ───────────────
      case "subscription_cancelled":
      case "subscription_expired": {
        if (!userId) break

        await db
          .update(users)
          .set({
            plan: "free",
            billingSubscriptionId: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))

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

function getPlanFromVariantId(variantId: string): "free" | "starter" | "pro" {
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_STARTER) return "starter"
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_PRO) return "pro"
  return "free"
}