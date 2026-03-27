"use client"

import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { useState } from "react"
import { Loader2Icon, AlertCircleIcon, XIcon } from "lucide-react"
import type { User } from "@/lib/db/schema"

interface Props {
  user: User | null
}

export function DashboardHeader({ user }: Props) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError]     = useState<string | null>(null)

  async function openBillingPortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setPortalError(data.error ?? "Could not open billing portal. Please try again.")
      }
    } catch {
      setPortalError("Network error. Please check your connection and try again.")
    } finally {
      setPortalLoading(false)
    }
  }

  const planBadge = {
    free:    { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" },
    starter: { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa" },
    pro:     { bg: "rgba(245,166,35,0.12)",  color: "var(--accent)" },
  }[user?.plan ?? "free"]

  // Extract first name from display name or email
  const firstName = user
    ? (() => {
        // Clerk users may have a name embedded; fall back to email prefix
        const email = (user as unknown as { email?: string }).email
        if (email) return email.split("@")[0].split(".")[0]
        return null
      })()
    : null

  return (
    <>
      <header
        style={{ background: "rgba(10,10,11,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-subtle)" }}
        className="sticky top-0 z-10"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--accent)", color: "#000" }}>D</span>
              <span className="font-bold text-base" style={{ fontFamily: "Syne, sans-serif" }}>DecayStore</span>
            </Link>
            {user && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                style={{ background: planBadge.bg, color: planBadge.color, fontFamily: "DM Mono, monospace" }}>
                {user.plan}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {firstName && (
              <span className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>
                Hi, <span style={{ color: "var(--text)" }}>{firstName}</span>
              </span>
            )}
            {user?.plan === "free" && (
              <Link href="/pricing"
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{ background: "var(--accent)", color: "#000" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                Upgrade
              </Link>
            )}
            {user?.billingCustomerId && (
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="text-xs transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--bg-card)" }}
                onMouseEnter={e => !portalLoading && (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                {portalLoading && <Loader2Icon className="w-3 h-3 animate-spin" />}
                {portalLoading ? "Loading…" : "Billing"}
              </button>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Billing error toast */}
      {portalError && (
        <div
          className="fixed top-20 right-4 z-50 flex items-start gap-3 rounded-xl px-4 py-3 max-w-sm shadow-xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid rgba(239,68,68,0.4)" }}
        >
          <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
          <p className="text-xs flex-1" style={{ color: "var(--text)" }}>{portalError}</p>
          <button onClick={() => setPortalError(null)} className="action-btn p-0.5 rounded shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}