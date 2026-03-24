"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { PLANS } from "@/lib/plans"
import { CheckIcon } from "lucide-react"

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(plan: "starter" | "pro") {
    if (!isSignedIn) {
      router.push("/auth/sign-up")
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
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          DecayStore
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          Dashboard →
        </Link>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple pricing</h1>
          <p className="text-lg text-gray-500">
            Pay for what you keep. Ignore it and it goes away.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["free", "starter", "pro"] as const).map((key) => {
            const plan = PLANS[key]
            const isPro = key === "pro"

            return (
              <div
                key={key}
                className={`rounded-2xl border p-8 flex flex-col ${
                  isPro
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-900"
                }`}
              >
                <div className="mb-6">
                  <p
                    className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                      isPro ? "text-gray-400" : "text-gray-400"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    {plan.price > 0 && (
                      <span className={`text-sm mb-1 ${isPro ? "text-gray-400" : "text-gray-400"}`}>
                        /mo
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-2 ${isPro ? "text-gray-400" : "text-gray-500"}`}>
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm">
                      <CheckIcon
                        className={`w-4 h-4 shrink-0 ${isPro ? "text-white" : "text-gray-900"}`}
                      />
                      <span className={isPro ? "text-gray-300" : "text-gray-600"}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {key === "free" ? (
                  <Link
                    href="/auth/sign-up"
                    className="block text-center border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:border-gray-400 transition-colors"
                  >
                    Get started free
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={loading === key}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isPro
                        ? "bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                        : "bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
                    }`}
                  >
                    {loading === key ? "Redirecting..." : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
