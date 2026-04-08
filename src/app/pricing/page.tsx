// ROUTE: /pricing
// FILE:  src/app/pricing/page.tsx

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { PLANS } from "@/lib/plans"
import { CheckIcon } from "lucide-react"
import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // [P19] Handles starter, pro, and trial plan checkouts.
  // Trial routes anonymous users to sign-up with intent param;
  // signed-in users go straight to the LemonSqueezy checkout.
  async function handleUpgrade(plan: "starter" | "pro" | "trial") {
    if (!isSignedIn) {
      router.push(plan === "trial" ? "/auth/sign-up?intent=trial" : "/auth/sign-up")
      return
    }
    setLoading(plan)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
          >
            Pricing
          </p>
          <h1 className="text-5xl font-bold mb-4">Simple, honest pricing.</h1>
          <p className="text-lg" style={{ color: "var(--text-muted)" }}>
            Pay for what you keep. Ignore it and it goes away.
          </p>
        </div>

        {/* [P19] Four-column grid: Free | Pro Trial | Starter | Pro */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

          {/* Free */}
          <div
            className="rounded-2xl p-7 flex flex-col"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                {PLANS.free.name}
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-5xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>$0</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{PLANS.free.description}</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.free.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-muted)" }}>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth/sign-up?intent=free" className="btn-ghost block text-center py-3 rounded-xl text-sm font-semibold">
              Get started free
            </Link>
          </div>

          {/* [P19] Pro Trial — highlighted, positioned before paid tiers */}
          <div
            className="rounded-2xl p-7 flex flex-col relative overflow-hidden"
            style={{
              background: "rgba(245,166,35,0.05)",
              border: "1px solid rgba(245,166,35,0.35)",
            }}
          >
            {/* Trial badge */}
            <div
              className="absolute top-0 left-0 right-0 text-xs font-bold px-3 py-1.5 text-center"
              style={{ background: "var(--accent)", color: "#000", fontFamily: "DM Mono, monospace" }}
            >
              START HERE — MOST POPULAR
            </div>

            <div className="mb-7 mt-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace" }}>
                {PLANS.trial.name}
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-bold" style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}>$0</span>
                <span className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>/ 14 days</span>
              </div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                then $15/mo — cancel any time
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{PLANS.trial.description}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.trial.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--text-muted)" }}>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade("trial")}
              disabled={loading === "trial"}
              className="py-3 rounded-xl text-sm font-semibold disabled:opacity-50 btn-accent"
            >
              {loading === "trial" ? "Redirecting…" : "Start free trial →"}
            </button>
            <p className="text-xs text-center mt-2" style={{ color: "var(--text-dim)" }}>
              Card required · no charge today
            </p>
          </div>

          {/* Starter */}
          <div
            className="rounded-2xl p-7 flex flex-col"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                {PLANS.starter.name}
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-5xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>${PLANS.starter.price}</span>
                <span className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>/mo</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{PLANS.starter.description}</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.starter.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-muted)" }}>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade("starter")}
              disabled={loading === "starter"}
              className="py-3 rounded-xl text-sm font-semibold disabled:opacity-50 btn-outline"
            >
              {loading === "starter" ? "Redirecting…" : "Upgrade to Starter"}
            </button>
          </div>

          {/* Pro */}
          <div
            className="rounded-2xl p-7 flex flex-col relative overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--accent)",
              boxShadow: "0 0 40px var(--accent-glow)",
            }}
          >
            <div
              className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg"
              style={{ background: "var(--accent)", color: "#000", fontFamily: "DM Mono, monospace" }}
            >
              POPULAR
            </div>
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace" }}>
                {PLANS.pro.name}
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-5xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>${PLANS.pro.price}</span>
                <span className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>/mo</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{PLANS.pro.description}</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PLANS.pro.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--text-muted)" }}>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={loading === "pro"}
              className="py-3 rounded-xl text-sm font-semibold disabled:opacity-50 btn-accent"
            >
              {loading === "pro" ? "Redirecting…" : "Upgrade to Pro"}
            </button>
          </div>

        </div>

        {/* [P19] Updated FAQ — adds trial questions */}
        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "How does the free trial work?",
                a: "You get full Pro features for 14 days. A payment card is required upfront but you won't be charged until day 15. Cancel any time before then and you'll never be billed. After the trial, if you don't cancel, your card is charged $15/mo and you stay on Pro.",
              },
              {
                q: "Why do I need a card for the trial?",
                a: "Requiring a card filters out non-serious signups and keeps the service fast for everyone. You can cancel at any point during the 14 days with zero charge.",
              },
              {
                q: "What happens when my trial ends?",
                a: "If you haven't cancelled, your card is charged $15/mo and you become a Pro subscriber automatically — no interruption to your files. If you have cancelled, your account moves to trial_expired: uploads are paused, existing files are safe for 14 more days, then normal decay applies.",
              },
              {
                q: "What happens when a file decays?",
                a: "The file is permanently deleted from Cloudflare R2 storage. This cannot be undone. You will receive email warnings at 50% and 90% decay before this happens.",
              },
              {
                q: "How do I prevent a file from being deleted?",
                a: "Simply download or access the file — this resets its decay clock to zero. You can also use the Renew button in the dashboard.",
              },
              {
                q: "Can I upgrade or downgrade my plan?",
                a: "Yes. You can manage your subscription any time via the Billing portal in your dashboard. Downgrades take effect at the end of your billing period.",
              },
              {
                q: "Is my data secure?",
                a: "All files are stored privately on Cloudflare R2. Download links use presigned URLs that expire after 1 hour. No file is publicly accessible unless you explicitly make it so.",
              },
              {
                q: "Do you offer refunds?",
                a: "We offer a prorated refund within 7 days of your subscription starting if you are not satisfied. Contact us at support@decaystore.com.",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl p-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <p className="text-sm font-semibold mb-2">{faq.q}</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}