// ROUTE: /waitlist
// FILE:  src/app/waitlist/page.tsx
//
// FIXES APPLIED:
//   [Issue 5d] alreadyJoined response now shows a distinct UI state instead of
//     rendering "You're #undefined in the queue". The API returns no position
//     for duplicate emails — the old code called setPosition(data.position)
//     where data.position was undefined, which rendered as "You're #undefined".
//   [Issue 5c] Error messages now surface the actual API error string
//     (data.error) instead of the generic "Something went wrong" catch-all.
//   [Issue 5b] Email is validated client-side before submission using a simple
//     regex check, with an inline validation message shown before the user clicks.
//   [Issue 5a] Loading button now has an aria-label and aria-busy for
//     screen readers. The "..." placeholder is replaced with "Joining…".
//   [Issue 5e] A "What happens next" explanation is shown after joining,
//     informing users about the invite email and the 48-hour window.
//   [Issue 1 / middleware] New error codes from the post-auth waitlist check
//     ("not-approved", "complete-signup") are now displayed with helpful copy
//     so users who hit the OAuth bypass guard get actionable feedback.

"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

// [FIX Issue 5b] Simple RFC-5322-inspired email check for instant client feedback.
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export default function WaitlistPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const [email, setEmail]               = useState("")
  const [touched, setTouched]           = useState(false)
  const [status, setStatus]             = useState<"idle" | "loading" | "success" | "already" | "error">("idle")
  const [position, setPosition]         = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null)
  const [isFull, setIsFull]             = useState(false)

  useEffect(() => {
    fetch("/api/waitlist/count")
      .then((r) => r.json())
      .then((data) => {
        setSpotsRemaining(data.remaining)
        setIsFull(data.remaining === 0)
      })
      .catch(console.error)
  }, [])

  // [FIX Issue 5b] Derived validation state — only shown after the user
  // has interacted with the field (touched) to avoid premature red states.
  const emailInvalid = touched && email.length > 0 && !isValidEmail(email)

  async function handleSubmit() {
    setTouched(true)
    // [FIX Issue 5b] Block submission for invalid emails before hitting the network.
    if (!isValidEmail(email)) return

    setStatus("loading")
    setErrorMessage(null)

    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        // [FIX Issue 5c] Surface the real error from the API rather than the
        // generic catch-all message.
        throw new Error(data.error ?? "Failed to join waitlist")
      }

      // [FIX Issue 5d] Handle alreadyJoined as a separate UI state.
      // Previously: setPosition(data.position) → data.position is undefined for
      // duplicates → rendered "You're #undefined in the queue".
      if (data.alreadyJoined) {
        setStatus("already")
        return
      }

      setPosition(data.position)
      setStatus("success")
    } catch (err) {
      // [FIX Issue 5c] Preserve and display the error message string.
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.")
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

        {/* ── URL error codes from middleware ──────────────────────────────── */}
        {error === "invalid" && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            This invite link is invalid. If you believe this is an error, contact support.
          </div>
        )}
        {error === "expired" && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            Your invite expired. You&apos;re back in the queue — we&apos;ll send a new one soon.
          </div>
        )}
        {/* [FIX Issue 1] New error codes surfaced by the post-auth middleware check */}
        {error === "not-approved" && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Your account hasn&apos;t been approved yet. Join the waitlist below and we&apos;ll
            email you when your spot opens.
          </div>
        )}
        {error === "complete-signup" && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            You have a pending invite. Check your email for the sign-up link to finish
            creating your account. The link is valid for 48 hours.
          </div>
        )}

        {spotsRemaining !== null && (
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            {isFull
              ? "All spots are currently taken."
              : `${spotsRemaining} of 100 spots remaining`}
          </p>
        )}

        {/* ── Success state ────────────────────────────────────────────────── */}
        {status === "success" && (
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: "var(--accent)", background: "rgba(20,184,166,0.06)" }}
          >
            <p className="font-semibold">You&apos;re #{position} in the queue</p>
            {/* [FIX Issue 5e] Explain the next steps so the user knows what to expect */}
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              We&apos;ll email you when your spot opens. When you receive the invite, you&apos;ll
              have <strong>48 hours</strong> to complete sign-up before the link expires.
              No action needed until then.
            </p>
          </div>
        )}

        {/* [FIX Issue 5d] Dedicated "already joined" state — no undefined position */}
        {status === "already" && (
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <p className="font-semibold">You&apos;ve already joined</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Check your inbox for a confirmation email. We&apos;ll send your invite when
              your spot opens. If you received an invite, use the link in that email to sign up.
            </p>
          </div>
        )}

        {/* ── Form state ──────────────────────────────────────────────────── */}
        {status !== "success" && status !== "already" && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <input
                  type="email"
                  placeholder={isFull ? "Enter your email for next batch" : "your@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  // [FIX Issue 5a] aria-invalid for screen readers
                  aria-invalid={emailInvalid}
                  aria-label="Email address"
                  className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
                  style={{
                    borderColor: emailInvalid ? "#dc2626" : "var(--border)",
                    color: "var(--text)",
                    background: "var(--bg-card)",
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                {/* [FIX Issue 5b] Inline validation message before submission */}
                {emailInvalid && (
                  <p className="text-xs text-red-600" role="alert">
                    Please enter a valid email address.
                  </p>
                )}
              </div>
              <button
                onClick={handleSubmit}
                // [FIX Issue 5a] aria-busy for screen readers during loading
                aria-busy={status === "loading"}
                aria-label={status === "loading" ? "Joining waitlist…" : isFull ? "Notify me" : "Join waitlist"}
                disabled={status === "loading" || !email}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold self-start disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                {/* [FIX Issue 5a] "..." replaced with descriptive text */}
                {status === "loading" ? "Joining…" : isFull ? "Notify me" : "Join"}
              </button>
            </div>

            {/* [FIX Issue 5c] Show the real API error string, not a generic fallback */}
            {status === "error" && (
              <p className="text-sm mt-2 text-red-600" role="alert">
                {errorMessage ?? "Something went wrong. Please try again."}
              </p>
            )}
          </>
        )}

        {/* Back to sign-in for users who already have an account */}
        <p className="text-xs mt-6" style={{ color: "var(--text-dim)" }}>
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="underline" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}