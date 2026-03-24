import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { createCheckoutSession } from "@/lib/stripe"
import { z } from "zod"

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
})

// POST /api/stripe/checkout — creates a LemonSqueezy checkout URL
export async function POST(request: Request) {
  try {
    const { userId: clerkId } = auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
