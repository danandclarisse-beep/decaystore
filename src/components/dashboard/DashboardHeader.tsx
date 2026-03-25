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

  const planBadge = {
    free:    { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" },
    starter: { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa" },
    pro:     { bg: "rgba(245,166,35,0.12)",  color: "var(--accent)" },
  }[user?.plan ?? "free"]

  return (
    <header
      style={{
        background: "rgba(10,10,11,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
      className="sticky top-0 z-10"
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              D
            </span>
            <span
              className="font-bold text-base"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              DecayStore
            </span>
          </Link>
          {user && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: planBadge.bg, color: planBadge.color, fontFamily: "DM Mono, monospace" }}
            >
              {user.plan}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user?.plan === "free" && (
            <Link
              href="/pricing"
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: "var(--accent)", color: "#000" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Upgrade
            </Link>
          )}
          {user?.stripeCustomerId && (
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="text-xs transition-colors px-3 py-1.5 rounded-lg"
              style={{
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              {portalLoading ? "Loading…" : "Billing"}
            </button>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  )
}