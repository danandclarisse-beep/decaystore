"use client"

import { useState, useEffect } from "react"
import { XIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

const ONBOARDED_KEY = "ds_onboarded_v1"

// ─── OnboardingBanner ─────────────────────────────────────
// [P6-2] Shown once to new users who have never seen the product explainer.
// Dismissed permanently via localStorage. Does not re-appear after dismissal.
export function OnboardingBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDED_KEY)
    if (!seen) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(ONBOARDED_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{
        background: "var(--bg-card)",
        border:     "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👋</span>
            <p className="text-base font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
              Welcome to DecayStore
            </p>
          </div>

          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
            DecayStore keeps only the files you actually care about.
            Every file has a decay timer — if you ignore it, it self-destructs.
            Download or renew a file to reset its timer and keep it alive.
          </p>

          {/* Decay scale visual */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {[
              { label: "Fresh",    color: "#22c55e", desc: "Just uploaded or accessed" },
              { label: "Aging",    color: "#84cc16", desc: "Starting to decay" },
              { label: "Stale",    color: "#eab308", desc: "Warning email sent" },
              { label: "Critical", color: "#f97316", desc: "Final warning" },
              { label: "Expiring", color: "#ef4444", desc: "Deletes very soon" },
            ].map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>→</span>
                )}
                <div className="flex items-center gap-1.5 group relative">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: stage.color }}
                  />
                  <span className="text-xs font-medium" style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <span>⬇️</span> Download to reset decay
            </div>
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <span>🔄</span> Renew button resets it manually
            </div>
            <div
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <span>📧</span> Email warnings at 50% and 90%
            </div>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="action-btn p-1.5 rounded-lg shrink-0 mt-0.5"
          aria-label="Dismiss welcome banner"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div
        className="mt-4 pt-4 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          This banner won&apos;t show again after you dismiss it.
        </p>
        <button
          onClick={dismiss}
          className="text-xs px-4 py-1.5 rounded-lg font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// ─── DecayExplainer ───────────────────────────────────────
// [P6-2] Collapsible inline explainer shown below the StorageBar.
// Stays permanently visible (not dismissible) as a reference.
// Defaults to collapsed after first expansion to not crowd the UI.
export function DecayExplainer({ plan }: { plan: string }) {
  const [open, setOpen] = useState(false)

  const decayDays: Record<string, number> = { free: 14, starter: 30, pro: 90 }
  const days = decayDays[plan] ?? 14

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-subtle)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>⏱</span>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            How decay works on your{" "}
            <span className="capitalize" style={{ color: "var(--text)" }}>{plan}</span> plan
            {" "}— files auto-delete after {days} days of inactivity
          </span>
        </div>
        {open
          ? <ChevronUpIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)" }} />
          : <ChevronDownIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)" }} />
        }
      </button>

      {open && (
        <div
          className="px-4 pb-4 pt-3 space-y-3"
          style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* Timeline bar */}
          <div>
            <div className="relative h-2 rounded-full overflow-hidden mb-1.5">
              <div className="absolute inset-0" style={{
                background: "linear-gradient(to right, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)"
              }} />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
              <span>0 days</span>
              <span>{Math.round(days * 0.5)}d — warning email</span>
              <span>{Math.round(days * 0.9)}d — critical email</span>
              <span>{days}d — deleted</span>
            </div>
          </div>

          {/* Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {[
              { emoji: "⬇️", title: "Downloading resets decay",   body: "Any download via the dashboard or API resets the timer to day 0." },
              { emoji: "🔄", title: "Renew resets decay",         body: "Hit Renew on any file card to reset it manually without downloading." },
              { emoji: "🗑️", title: "100% decay = permanent delete", body: "Deleted files cannot be recovered. Warnings are sent before this happens." },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg px-3 py-2.5"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
              >
                <p className="text-xs font-semibold mb-0.5">
                  {item.emoji} {item.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          {plan === "free" && (
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Upgrade to Starter (30 days) or Pro (90 days) for a longer decay window and more storage.{" "}
              <a href="/pricing" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                See plans →
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}