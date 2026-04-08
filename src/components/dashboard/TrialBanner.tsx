"use client"

import { useState, useEffect } from "react"
import { ClockIcon, XIcon }   from "lucide-react"
import type { User }           from "@/lib/db/schema"

interface Props {
  user: User
  onUpgrade: () => void
}

export function TrialBanner({ user, onUpgrade }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (user.plan !== "trial") return
    const dismissKey = `ds_trial_banner_${user.id}`
    const dismissed  = sessionStorage.getItem(dismissKey)
    if (!dismissed) setVisible(true)
  }, [user])

  function dismiss() {
    sessionStorage.setItem(`ds_trial_banner_${user.id}`, "1")
    setVisible(false)
  }

  if (!visible || user.plan !== "trial" || !user.trialEndsAt) return null

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86_400_000)
  )

  return (
    <div
      className="rounded-2xl p-4 mb-4 flex items-center gap-3"
      style={{
        background: "rgba(20,184,166,0.06)",
        border: "1px solid rgba(245,166,35,0.3)",
      }}
    >
      <ClockIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
      <p className="text-sm flex-1" style={{ color: "var(--text-muted)" }}>
        Trial: <strong style={{ color: "var(--text)" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</strong>
      </p>
      <button
        onClick={onUpgrade}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        Upgrade to Pro
      </button>
      <button
        onClick={dismiss}
        className="action-btn p-1 rounded-lg"
        aria-label="Dismiss"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}