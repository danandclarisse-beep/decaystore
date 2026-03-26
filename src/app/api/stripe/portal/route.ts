import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { createPortalSession } from "@/lib/lemonsqueezy"

// POST /api/stripe/portal — opens LemonSqueezy customer portal
export async function POST() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    if (!user.billingCustomerId) {
      // No subscription yet — send to pricing
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      })
    }

    const session = await createPortalSession(user.billingCustomerId)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[POST /api/stripe/portal]", err)
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 })
  }
}