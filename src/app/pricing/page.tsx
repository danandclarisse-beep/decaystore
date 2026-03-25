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

  async function handleUpgrade(plan: "starter" | "pro") {
    if (!isSignedIn) { router.push("/auth/sign-up"); return }
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

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-28">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(["free", "starter", "pro"] as const).map((key) => {
            const plan = PLANS[key]
            const isPro = key === "pro"

            return (
              <div
                key={key}
                className="rounded-2xl p-7 flex flex-col relative overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: isPro ? "1px solid var(--accent)" : "1px solid var(--border)",
                  boxShadow: isPro ? "0 0 40px var(--accent-glow)" : "none",
                }}
              >
                {isPro && (
                  <div
                    className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg"
                    style={{ background: "var(--accent)", color: "#000", fontFamily: "DM Mono, monospace" }}
                  >
                    POPULAR
                  </div>
                )}

                <div className="mb-7">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: isPro ? "var(--accent)" : "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-5xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>/mo</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm">
                      <CheckIcon
                        className="w-4 h-4 shrink-0"
                        style={{ color: isPro ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <span style={{ color: "var(--text-muted)" }}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {key === "free" ? (
                  <Link href="/auth/sign-up" className="btn-ghost block text-center py-3 rounded-xl text-sm font-semibold">
                    Get started free
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={loading === key}
                    className={`py-3 rounded-xl text-sm font-semibold disabled:opacity-50 ${isPro ? "btn-accent" : "btn-outline"}`}
                  >
                    {loading === key ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
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