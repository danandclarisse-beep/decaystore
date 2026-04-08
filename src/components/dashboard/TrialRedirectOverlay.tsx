// FILE: src/components/dashboard/TrialRedirectOverlay.tsx
// [P19] Full-screen overlay displayed while the dashboard is generating the
// LemonSqueezy checkout URL for a new trial sign-up.
// Gives users clear visual feedback so the process never looks frozen or broken.

"use client"

import { useEffect, useState } from "react"
import { ZapIcon, ShieldCheckIcon, CreditCardIcon } from "lucide-react"

interface Props {
  visible: boolean
}

const STEPS = [
  { icon: ShieldCheckIcon, label: "Account created successfully" },
  { icon: CreditCardIcon,  label: "Preparing secure checkout…"   },
  { icon: ZapIcon,         label: "Redirecting to payment page…" },
]

export function TrialRedirectOverlay({ visible }: Props) {
  const [step, setStep] = useState(0)

  // Animate through the steps to give visual progress
  useEffect(() => {
    if (!visible) { setStep(0); return }
    const t1 = setTimeout(() => setStep(1), 700)
    const t2 = setTimeout(() => setStep(2), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center gap-8 px-6"
      style={{ background: "var(--bg)", backdropFilter: "blur(8px)" }}
      aria-live="polite"
      role="status"
    >
      {/* Logo-like pulse ring */}
      <div className="relative flex items-center justify-center">
        <span
          className="absolute w-24 h-24 rounded-full animate-ping opacity-20"
          style={{ background: "var(--accent)" }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <ZapIcon className="w-8 h-8" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center max-w-xs">
        <p
          className="text-xl font-bold mb-1"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}
        >
          Starting your 14-day Pro trial
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No charge today — $15/mo only after your trial ends. Cancel anytime.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {STEPS.map(({ icon: Icon, label }, i) => {
          const done    = i < step
          const active  = i === step
          const pending = i > step

          return (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500"
              style={{
                background: active
                  ? "rgba(245,166,35,0.10)"
                  : done
                  ? "rgba(245,166,35,0.04)"
                  : "var(--bg-card)",
                border: `1px solid ${
                  active
                    ? "rgba(245,166,35,0.4)"
                    : done
                    ? "rgba(20, 184, 166, 0.2)"
                    : "var(--border)"
                }`,
                opacity: pending ? 0.4 : 1,
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: done || active ? "var(--accent)" : "var(--text-dim)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: done || active ? "var(--text)" : "var(--text-muted)" }}
              >
                {label}
              </span>
              {done && (
                <svg
                  className="ml-auto w-4 h-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ color: "var(--accent)" }}
                >
                  <path
                    d="M3 8l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {active && (
                <span
                  className="ml-auto w-2 h-2 rounded-full animate-pulse shrink-0"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Reassurance note */}
      <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-dim)" }}>
        You will be taken to a secure LemonSqueezy checkout. Your card is not charged until the trial ends.
      </p>
    </div>
  )
}