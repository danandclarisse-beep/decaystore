"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { XIcon } from "lucide-react"
import { PLANS } from "@/lib/plans"
import type { PlanKey } from "@/lib/plans"

interface Props {
  plan:     PlanKey
  nextPlan: PlanKey
}

export function NudgeStrip({ plan, nextPlan }: Props) {
  const storageKey = `ds_nudge_dismissed_${plan}`
  const [visible, setVisible] = useState(false)

  // Read from sessionStorage on mount — show only if not dismissed this session
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(storageKey)
      if (!dismissed) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [storageKey])

  function dismiss() {
    setVisible(false)
    try { sessionStorage.setItem(storageKey, "1") } catch {}
  }

  if (!visible) return null

  const nextConfig = PLANS[nextPlan]

  const message =
    plan === "free"
      ? `You're on the Free plan · 1 GB · 14-day decay window`
      : `You're on Starter · Upgrade to Pro for API access, custom decay rates & analytics`

  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-2.5 text-xs"
      style={{
        background: "var(--accent-dim)",
        borderBottom: "1px solid rgba(245,166,35,0.15)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        <span style={{ color: "var(--text-muted)" }} className="truncate">
          {message}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/pricing"
          className="font-semibold text-xs px-3 py-1 rounded-lg transition-all"
          style={{
            background: "var(--accent)",
            color: "#000",
          }}
        >
          Upgrade to {nextConfig.name} →
        </Link>
        <button
          onClick={dismiss}
          className="rounded p-0.5 transition-colors"
          style={{ color: "var(--text-dim)" }}
          aria-label="Dismiss"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
