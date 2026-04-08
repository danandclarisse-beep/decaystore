// FILE: src/components/dashboard/SubscriptionSuccessModal.tsx
// [P19] Congratulations modal shown once when the user returns from a successful
// LemonSqueezy checkout (any plan: starter, pro, or trial).
// Replaces / supplements the previous inline UpgradeBanner so there is a clear,
// unmissable confirmation of what they just activated.

"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  XIcon, ZapIcon, CheckIcon, SparklesIcon,
  ClockIcon, DatabaseIcon, ShieldCheckIcon,
} from "lucide-react"
import { PLANS } from "@/lib/plans"
import type { User } from "@/lib/db/schema"

interface Props {
  user: User | null
}

// Per-plan copy & feature bullets shown in the modal.
// [FIX] Trial specs now match plans.ts exactly:
//   - 1 GB storage cap during trial
//   - 90-day decay window
const PLAN_META: Record<
  string,
  {
    emoji:       string
    headline:    string
    sub:         string
    highlights:  { icon: typeof ZapIcon; text: string }[]
    cta:         string
  }
> = {
  trial: {
    emoji:    "🎉",
    headline: "Your 14-day Pro Trial is active!",
    sub:      "Full Pro access at no charge until your trial ends. We'll remind you 3 days before billing begins.",
    highlights: [
      { icon: DatabaseIcon,    text: "1 GB storage during trial"              },
      { icon: ClockIcon,       text: "90-day decay window"                    },
      { icon: ZapIcon,         text: "Custom decay rates per file"            },
      { icon: ShieldCheckIcon, text: "API access + priority support"          },
    ],
    cta: "Start exploring →",
  },
  starter: {
    emoji:    "🚀",
    headline: "Welcome to Starter!",
    sub:      "Your account has been upgraded. Here's what you now have access to:",
    highlights: [
      { icon: DatabaseIcon,    text: `${PLANS.starter.storageGB} GB storage`   },
      { icon: ZapIcon,         text: `Up to ${PLANS.starter.maxFiles} files`   },
      { icon: ClockIcon,       text: `${PLANS.starter.decayDays}-day decay window` },
      { icon: ShieldCheckIcon, text: "Email warnings & renewal"                },
    ],
    cta: "Go to dashboard →",
  },
  pro: {
    emoji:    "⚡",
    headline: "Welcome to Pro!",
    sub:      "You now have the full experience — everything unlocked.",
    highlights: [
      { icon: DatabaseIcon,    text: `${PLANS.pro.storageGB} GB storage`       },
      { icon: ZapIcon,         text: "Unlimited files"                          },
      { icon: ClockIcon,       text: `${PLANS.pro.decayDays}-day decay window` },
      { icon: ShieldCheckIcon, text: "API access + developer docs"              },
    ],
    cta: "Go to dashboard →",
  },
}

// How long to poll for the plan to be applied before giving up (ms)
const POLL_TIMEOUT_MS  = 30_000
const POLL_INTERVAL_MS = 1_500

export function SubscriptionSuccessModal({ user: initialUser }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [open,    setOpen]    = useState(false)
  const [user,    setUser]    = useState(initialUser)
  // [FIX] Track whether we are waiting for the webhook to apply the plan
  const [polling, setPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Only trigger when returning from a successful checkout
    const wasUpgraded = searchParams.get("upgraded") === "true"
    if (!wasUpgraded) return

    // Clean the URL immediately so a refresh doesn't re-show the modal
    const url = new URL(window.location.href)
    url.searchParams.delete("upgraded")
    router.replace(url.pathname + (url.search || ""), { scroll: false })

    // [FIX] If the user's plan is already non-free (webhook fired before redirect
    // completed), show the modal immediately using the data we already have.
    if (initialUser && initialUser.plan !== "free") {
      const seenKey = `ds_success_modal_${initialUser.plan}_${initialUser.id}`
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, "1")
        setOpen(true)
      }
      return
    }

    // [FIX] Webhook hasn't updated the DB yet — poll /api/files (which returns
    // the current user row) until the plan changes away from "free", then show
    // the modal. This prevents the modal from silently suppressing itself because
    // user.plan === "free" at the moment the redirect lands.
    setPolling(true)
    const startedAt = Date.now()

    pollRef.current = setInterval(async () => {
      // Give up after POLL_TIMEOUT_MS — avoids an infinite loop if the webhook
      // never fires (e.g. misconfigured env var).
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current!)
        setPolling(false)
        console.warn("[SubscriptionSuccessModal] Timed out waiting for plan update")
        return
      }

      try {
        const res  = await fetch("/api/files")
        if (!res.ok) return
        const data = await res.json()
        const latestUser: User | null = data.user ?? null

        if (latestUser && latestUser.plan !== "free") {
          clearInterval(pollRef.current!)
          setPolling(false)
          setUser(latestUser)

          const seenKey = `ds_success_modal_${latestUser.plan}_${latestUser.id}`
          if (!localStorage.getItem(seenKey)) {
            localStorage.setItem(seenKey, "1")
            setOpen(true)
          }
        }
      } catch {
        // swallow — will retry on next tick
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  function close() { setOpen(false) }

  // [FIX] Render a "waiting" state while polling so the user knows something
  // is happening instead of seeing a blank screen.
  if (polling) {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
        role="status"
        aria-label="Activating your plan…"
      >
        <div
          className="flex flex-col items-center gap-4 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {/* Simple CSS spinner — no extra dependency */}
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent) transparent var(--accent) var(--accent)" }}
          />
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Activating your plan…
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Just a moment while we confirm your subscription.
          </p>
        </div>
      </div>
    )
  }

  if (!open || !user || user.plan === "free") return null

  const meta = PLAN_META[user.plan] ?? PLAN_META.pro

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`Subscription success: ${user.plan} plan activated`}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background:  "var(--bg-card)",
          border:      "1px solid rgba(245,166,35,0.40)",
          boxShadow:   "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,166,35,0.10)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent top stripe */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, var(--accent) 0%, rgba(245,166,35,0.3) 100%)" }}
        />

        {/* Close */}
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label="Close"
        >
          <XIcon className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Emoji + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <span
              className="text-5xl mb-4 select-none"
              role="img"
              aria-hidden="true"
            >
              {meta.emoji}
            </span>
            <h2
              className="text-xl font-bold mb-2 leading-tight"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}
            >
              {meta.headline}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {meta.sub}
            </p>
          </div>

          {/* Feature bullets */}
          <div
            className="rounded-xl p-4 mb-6 space-y-2.5"
            style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.15)" }}
          >
            {meta.highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,166,35,0.15)" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</span>
                <CheckIcon className="ml-auto w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
              </div>
            ))}
          </div>

          {/* Trial-specific billing note */}
          {user.plan === "trial" && user.trialEndsAt && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-6 text-xs"
              style={{
                background: "var(--bg-elevated, var(--bg-card))",
                border:     "1px solid var(--border)",
                color:      "var(--text-muted)",
              }}
            >
              <ClockIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
              <span>
                Trial ends on{" "}
                <strong style={{ color: "var(--text)" }}>
                  {new Date(user.trialEndsAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </strong>
                . We&apos;ll email you 3 days before. $15/mo after — cancel anytime.
              </span>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={close}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            <SparklesIcon className="w-4 h-4" />
            {meta.cta}
          </button>
        </div>
      </div>
    </div>
  )
}