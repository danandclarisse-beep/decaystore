export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getUserByClerkId } from "@/lib/auth-helpers"
import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"
import { AccountSettingsClient } from "./AccountSettingsClient"

export const metadata = {
  title: "Account Settings — DecayStore",
}

export default async function AccountPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/auth/sign-in")

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect("/auth/sign-in")

  return (
    <>
      <Nav userPlan={user.plan} />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Account Settings
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Manage your profile, notifications, billing, and account data.
          </p>
        </div>

        <AccountSettingsClient user={user} />
      </main>
      <Footer />
    </>
  )
}
