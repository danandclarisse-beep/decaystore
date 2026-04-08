"use client"

import { AlertTriangleIcon } from "lucide-react"
import type { User }          from "@/lib/db/schema"

interface Props {
  user: User
  onUpgrade: () => void
}

export function TrialExpiredBanner({ user, onUpgrade }: Props) {
  if (user.plan !== "trial_expired" || !user.trialExpiredAt) return null

  const firstDeletion = new Date(user.trialExpiredAt)
  firstDeletion.setDate(firstDeletion.getDate() + 14)

  const daysToDelete = Math.max(
    0,
    Math.ceil((firstDeletion.getTime() - Date.now()) / 86_400_000)
  )

  const dateStr = firstDeletion.toLocaleDateString("en-US", {
    month: "long", day: "numeric",
  })

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.3)",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#ef4444" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
            Your trial has ended
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {daysToDelete > 0
              ? `Files will begin deleting on ${dateStr} (${daysToDelete} days).`
              : `Files are being deleted.`}{" "}
            Subscribe to stop this immediately.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          Upgrade — $15/mo
        </button>
      </div>
    </div>
  )
}