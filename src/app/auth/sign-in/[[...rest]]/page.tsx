// ROUTE: /auth/sign-in
// FILE:  src/app/auth/sign-in/[[...rest]]/page.tsx
//
// FIXES APPLIED:
//   [Issue 2 — HIGH] Sign-in page now has waitlist awareness.
//     Previously this was a bare <SignIn /> with no surrounding context,
//     leaving users with no feedback about the controlled rollout and no
//     redirect path for unapproved accounts.
//
//     Changes:
//     - Added an informational banner above <SignIn /> explaining that
//       DecayStore is in a controlled rollout and that sign-in is only
//       for users who have already completed sign-up via an invite link.
//     - Added a "Join the waitlist" link for visitors who haven't been
//       approved yet, matching the UX of the sign-up page's IntentBanner.
//     - Handles the "not-approved" and "complete-signup" error codes that
//       the fixed middleware now redirects with, so unapproved users who
//       slip through OAuth land on a helpful error page rather than a
//       generic Clerk error.
//     - The middleware post-auth check (Issue 1 fix) handles the actual
//       enforcement; this page provides the human-readable communication layer.

"use client"

import { SignIn } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { LockIcon } from "lucide-react"

function WaitlistBanner() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  // Errors injected by the middleware post-auth waitlist check (Issue 1 fix).
  if (error === "not-approved") {
    return (
      <div
        className="w-full max-w-md mx-auto mb-5 px-5 py-4 rounded-2xl"
        style={{
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.30)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "#dc2626" }}>
          Access restricted
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Your account hasn&apos;t been approved yet.{" "}
          <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }}>
            Check your waitlist status
          </Link>{" "}
          or wait for your invite email.
        </p>
      </div>
    )
  }

  if (error === "complete-signup") {
    return (
      <div
        className="w-full max-w-md mx-auto mb-5 px-5 py-4 rounded-2xl"
        style={{
          background: "rgba(245,166,35,0.08)",
          border: "1px solid rgba(245,166,35,0.35)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          Finish your sign-up first
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          You have a pending invite. Check your email for the sign-up link and
          complete account creation before signing in.
        </p>
      </div>
    )
  }

  // Default informational banner — shown to all visitors on this page.
  return (
    <div
      className="w-full max-w-md mx-auto mb-5 px-5 py-4 rounded-2xl"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(20,184,166,0.12)", color: "var(--accent)" }}
        >
          <LockIcon className="w-3.5 h-3.5" />
        </div>
        <p className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif", color: "var(--text)" }}>
          Invite-only access
        </p>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        DecayStore is in a controlled rollout. Sign-in is only available for users
        who have already created an account via an invite link.{" "}
        <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }}>
          Join the waitlist
        </Link>{" "}
        if you haven&apos;t been approved yet.
      </p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      <Suspense>
        <WaitlistBanner />
      </Suspense>
      <SignIn />
    </main>
  )
}