"use client"

import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { useState } from "react"
import type { User } from "@/lib/db/schema"

interface Props {
  user: User | null
}

export function DashboardHeader({ user }: Props) {
  const [portalLoading, setPortalLoading] = useState(false)

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  const planBadgeColor = {
    free: "bg-gray-100 text-gray-600",
    starter: "bg-blue-50 text-blue-700",
    pro: "bg-purple-50 text-purple-700",
  }[user?.plan ?? "free"]

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-lg tracking-tight text-gray-900">
            DecayStore
          </Link>
          {user && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${planBadgeColor}`}>
              {user.plan}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user?.plan === "free" && (
            <Link
              href="/pricing"
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
            >
              Upgrade
            </Link>
          )}
          {user?.stripeCustomerId && (
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              {portalLoading ? "Loading..." : "Billing"}
            </button>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  )
}
