// ROUTE: /auth/sign-up
// FILE:  src/app/auth/sign-up/[[...rest]]/page.tsx

"use client"

import { SignUp } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"
import { ZapIcon, ShieldCheckIcon } from "lucide-react"

function IntentBanner() {
  const searchParams = useSearchParams()
  const intent = searchParams.get("intent")

  // Persist intent across the Clerk OAuth redirect so the dashboard
  // can read it after account creation and redirect to checkout.
  useEffect(() => {
    if (intent === "trial" || intent === "free") {
      try {
        sessionStorage.setItem("ds_signup_intent", intent)
      } catch {}
    }
  }, [intent])

  if (intent !== "trial" && intent !== "free") return null

  if (intent === "trial") {
    return (
      <div
        className="w-full max-w-md mx-auto mb-5 px-5 py-4 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(245,166,35,0.10) 0%, rgba(245,166,35,0.04) 100%)",
          border: "1px solid rgba(245,166,35,0.35)",
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            <ZapIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}>
              14-day Pro Trial
            </p>
            <p className="text-xs" style={{ color: "var(--accent)" }}>
              Free today — $15/mo after your trial
            </p>
          </div>
        </div>

        {/* What happens next */}
        <div className="space-y-1.5">
          {[
            { step: "1", text: "Create your account below" },
            { step: "2", text: "Enter your card (secure checkout)" },
            { step: "3", text: "Enjoy full Pro access — no charge for 14 days" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{ background: "rgba(20, 184, 166, 0.2)", color: "var(--accent)" }}
              >
                {step}
              </span>
              {text}
            </div>
          ))}
        </div>

        {/* Reassurance */}
        <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(20,184,166,0.15)" }}>
          <ShieldCheckIcon className="w-3 h-3 shrink-0" style={{ color: "var(--text-dim)" }} />
          <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Cancel anytime from Account settings. No charge before your trial ends.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-md mx-auto mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0 mt-1"
        style={{ background: "var(--text-dim)" }}
      />
      <div>
        <p className="font-semibold">Free plan</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          1 GB storage · 100 files · 14-day decay window · No credit card required.
        </p>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      <Suspense>
        <IntentBanner />
      </Suspense>
      <SignUp />
    </main>
  )
}