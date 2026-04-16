// ROUTE: /sso-callback
// FILE:  src/app/sso-callback/page.tsx
//
// PURPOSE:
//   Clerk's social OAuth (Google, GitHub, etc.) completes on Clerk's hosted
//   infrastructure, then redirects the user to this page with the session
//   already established in the browser cookie. By the time any middleware
//   runs on a protected route, the Clerk session is already valid.
//
//   This page is the ONLY in-app interception point before the user reaches
//   the dashboard. It:
//     1. Waits for Clerk to finish hydrating the session (AuthenticateWithRedirectCallback)
//     2. After hydration, checks /api/waitlist/check-status for the current user's email
//     3. If approved (status === "signed_up"), redirects to /dashboard
//     4. If not approved, calls /api/account/delete-self to remove the just-created
//        Clerk account (so it can't be reused), then redirects to /waitlist
//
//   The middleware post-auth check (Issue 1) remains as a defence-in-depth layer,
//   but this page closes the race window where a session exists but the middleware
//   hasn't run yet.
//
// CLERK SETUP REQUIRED:
//   In your Clerk dashboard → SSO Connections → Redirect URLs, set the
//   post-OAuth redirect to: https://yourdomain.com/sso-callback
//   (or set NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/sso-callback in .env)

"use client"

import { AuthenticateWithRedirectCallback, useUser, useClerk } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

function WaitlistGate() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "approved" | "rejected">("checking")

  useEffect(() => {
    if (!isLoaded || !user) return

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) {
      // No email on the Clerk account — cannot verify, reject immediately
      signOut().then(() => router.replace("/waitlist?error=not-approved"))
      return
    }

    // Check waitlist status server-side
    fetch("/api/waitlist/check-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (data.approved) {
          setStatus("approved")
          router.replace("/dashboard")
        } else {
          setStatus("rejected")
          // Delete the just-created Clerk account so it cannot be reused
          // to bypass the gate on future attempts.
          try {
            await fetch("/api/account/delete-self", { method: "DELETE" })
          } catch {
            // Best-effort — if deletion fails, the middleware post-auth check
            // will still redirect them on every subsequent request.
          }
          const errorCode = data.status === "approved" ? "complete-signup" : "not-approved"
          await signOut()
          router.replace(`/waitlist?error=${errorCode}`)
        }
      })
      .catch(() => {
        // On network error, fail safe: sign out and send to waitlist
        signOut().then(() => router.replace("/waitlist?error=not-approved"))
      })
  }, [isLoaded, user, signOut, router])

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          role="status"
          aria-label="Verifying access…"
        />
        <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "Syne, sans-serif" }}>
          {status === "checking" ? "Verifying access…" : status === "approved" ? "Approved, redirecting…" : "Checking waitlist…"}
        </p>
      </div>
    </main>
  )
}

export default function SSOCallbackPage() {
  return (
    <>
      <AuthenticateWithRedirectCallback />
      <WaitlistGate />
    </>
  )
}