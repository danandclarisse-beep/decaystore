"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { XIcon, ZapIcon, CheckIcon } from "lucide-react"
import { PLANS, PLAN_STORAGE_LIMITS } from "@/lib/plans"
import { formatBytes } from "@/lib/utils"
import type { User } from "@/lib/db/schema"

interface Props {
  user: User | null
}

// [P6-1] Shown once when the user lands on /dashboard?upgraded=true after
// completing the LemonSqueezy checkout. Clears the query param from the URL
// and stores a dismissed key in localStorage so it never re-appears.
export function UpgradeBanner({ user }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    const wasUpgraded = searchParams.get("upgraded") === "true"
    const dismissKey  = `ds_upgrade_banner_${user.plan}_${user.id}`
    const alreadySeen = localStorage.getItem(dismissKey)

    if (wasUpgraded && !alreadySeen) {
      setVisible(true)
      // Remove ?upgraded=true from the URL without a page reload
      const url = new URL(window.location.href)
      url.searchParams.delete("upgraded")
      router.replace(url.pathname + (url.search || ""), { scroll: false })
    }
  }, [searchParams, user, router])

  function dismiss() {
    if (!user) return
    const dismissKey = `ds_upgrade_banner_${user.plan}_${user.id}`
    localStorage.setItem(dismissKey, "1")
    setVisible(false)
  }

  if (!visible || !user || user.plan === "free") return null

  const plan       = PLANS[user.plan as keyof typeof PLANS]
  const storageStr = formatBytes(PLAN_STORAGE_LIMITS[user.plan as keyof typeof PLAN_STORAGE_LIMITS])

  const highlights: string[] = {
    starter: [
      `${storageStr} storage`,
      `Up to ${plan.maxFiles.toLocaleString()} files`,
      `${plan.decayDays}-day decay window`,
      "Email warnings & renewal",
    ],
    pro: [
      `${storageStr} storage`,
      "Unlimited files",
      `${plan.decayDays}-day decay window`,
      "Custom decay rates per file",
      "API access + developer docs",
      "Priority support (24h)",
    ],
  }[user.plan] ?? []

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mb-4"
      style={{
        background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.03) 100%)",
        border:     "1px solid rgba(245,166,35,0.35)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <ZapIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
            You&apos;re now on {plan.name}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {plan.description} — here&apos;s what&apos;s unlocked:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3">
            {highlights.map((h) => (
              <div key={h} className="flex items-center gap-2 text-sm">
                <CheckIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--text-muted)" }}>{h}</span>
              </div>
            ))}
          </div>
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