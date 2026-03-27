import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { createCheckoutSession } from "@/lib/lemonsqueezy"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
})

// POST /api/stripe/checkout — creates a LemonSqueezy checkout URL
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // [S3] Rate limit: max 5 checkout attempts per user per minute.
    const rl = rateLimit(clerkId, "checkout", 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      )
    }

    const user = await getOrCreateUser()
    const body = await request.json()
    const { plan } = checkoutSchema.parse(body)

    const session = await createCheckoutSession(user.id, user.email, plan)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[POST /api/stripe/checkout]", err)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}