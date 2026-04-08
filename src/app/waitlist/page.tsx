"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function WaitlistPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [position, setPosition] = useState<number | null>(null)
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null)
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    fetch("/api/waitlist/count")
      .then((r) => r.json())
      .then((data) => {
        setSpotsRemaining(data.remaining)
        setIsFull(data.remaining === 0)
      })
      .catch(console.error)
  }, [])

  async function handleSubmit() {
    setStatus("loading")
    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPosition(data.position)
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
          Decay<span style={{ color: "var(--accent)" }}>Store</span>
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Storage with a memory. Currently in controlled rollout.
        </p>

        {error === "invalid" && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            This invite link is invalid.
          </div>
        )}
        {error === "expired" && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            Your invite expired. You're back in the queue — we'll send a new one soon.
          </div>
        )}

        {spotsRemaining !== null && (
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            {isFull
              ? "All spots are currently taken."
              : `${spotsRemaining} of 100 spots remaining`}
          </p>
        )}

        {status === "success" ? (
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: "var(--accent)", background: "rgba(245,166,35,0.06)" }}
          >
            <p className="font-semibold">You're #{position} in the queue</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              We'll email you when your spot opens. No action needed until then.
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              placeholder={isFull ? "Enter your email for next batch" : "your@email.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
              style={{ borderColor: "var(--border)" }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              onClick={handleSubmit}
              disabled={status === "loading" || !email}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              {status === "loading" ? "..." : isFull ? "Notify me" : "Join"}
            </button>
          </div>
        )}

        {status === "error" && (
          <p className="text-sm mt-2 text-red-600">Something went wrong. Please try again.</p>
        )}
      </div>
    </main>
  )
}