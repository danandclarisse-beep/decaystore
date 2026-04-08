"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { XIcon, ZapIcon, CheckIcon, ClockIcon } from "lucide-react"
import { PLANS, PLAN_STORAGE_LIMITS } from "@/lib/plans"
import { formatBytes } from "@/lib/utils"
import type { User } from "@/lib/db/schema"

interface Props {
  user: User | null
}

// [P6-1 / P19] Secondary inline banner shown after a successful checkout return.
// The primary celebration is now handled by SubscriptionSuccessModal (P19).
// This banner persists in the dashboard until the user dismisses it, serving as
// a persistent reminder of what they activated — including the trial plan.
// NOTE: URL cleanup (?upgraded=true) is performed by SubscriptionSuccessModal
// so this component no longer needs to do it.
export function UpgradeBanner({ user }: Props) {
  const searchParams = useSearchParams()
  const [visible, setVisible]   = useState(false)

  useEffect(() => {
    if (!user) return
    const wasUpgraded = searchParams.get("upgraded") === "true"
    const dismissKey  = `ds_upgrade_banner_${user.plan}_${user.id}`
    const alreadySeen = localStorage.getItem(dismissKey)

    // Show the banner once per plan, triggered by ?upgraded=true.
    // SubscriptionSuccessModal handles URL cleanup, so we only check the flag.
    if (wasUpgraded && !alreadySeen) {
      setVisible(true)
    }
  }, [searchParams, user])

  function dismiss() {
    if (!user) return
    localStorage.setItem(`ds_upgrade_banner_${user.plan}_${user.id}`, "1")
    setVisible(false)
  }

  // Exclude free and trial_expired; trial IS shown (user just activated it)
  if (!visible || !user || user.plan === "free" || user.plan === "trial_expired") return null

  const isTrial    = user.plan === "trial"
  // For trial, fall back to "pro" plan config since trial === pro feature set
  const planKey    = isTrial ? "pro" : user.plan
  const plan       = PLANS[planKey as keyof typeof PLANS]
  const storageStr = formatBytes(PLAN_STORAGE_LIMITS[planKey as keyof typeof PLAN_STORAGE_LIMITS])

  const highlights: string[] = isTrial
    ? [
        `${storageStr} storage`,
        "Unlimited files",
        `${plan?.decayDays ?? 365}-day decay window`,
        "API access + developer docs",
      ]
    : ({
        starter: [
          `${storageStr} storage`,
          `Up to ${plan?.maxFiles?.toLocaleString() ?? "1,000"} files`,
          `${plan?.decayDays ?? 90}-day decay window`,
          "Email warnings & renewal",
        ],
        pro: [
          `${storageStr} storage`,
          "Unlimited files",
          `${plan?.decayDays ?? 365}-day decay window`,
          "Custom decay rates per file",
          "API access + developer docs",
          "Priority support (24h)",
        ],
      } as Record<string, string[]>)[user.plan] ?? []

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mb-4"
      style={{
        background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(245,166,35,0.03) 100%)",
        border:     "1px solid rgba(245,166,35,0.35)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          {isTrial ? <ClockIcon className="w-5 h-5" /> : <ZapIcon className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
            {isTrial ? "14-day Pro trial — active" : `You're now on ${plan?.name ?? user.plan}`}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {isTrial
              ? "Full Pro access at no charge for 14 days. Here's what's unlocked:"
              : `${plan?.description ?? ""} — here's what's unlocked:`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3">
            {highlights.map((h) => (
              <div key={h} className="flex items-center gap-2 text-sm">
                <CheckIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--text-muted)" }}>{h}</span>
              </div>
            ))}
          </div>

          {/* Trial billing note */}
          {isTrial && user.trialEndsAt && (
            <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
              Trial ends{" "}
              <strong style={{ color: "var(--text-muted)" }}>
                {new Date(user.trialEndsAt).toLocaleDateString(undefined, {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </strong>
              {" "}— $15/mo after. Cancel anytime from Account settings.
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="action-btn p-1.5 rounded-lg shrink-0"
          aria-label="Dismiss"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}