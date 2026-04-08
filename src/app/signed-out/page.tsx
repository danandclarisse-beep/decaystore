// ROUTE: /signed-out
// FILE:  src/app/signed-out/page.tsx
//
// [P19] Post-deletion cookie purge page.
//
// Why NOT useClerk().signOut():
//   The Clerk user was already deleted server-side in DELETE /api/account.
//   Calling signOut() from the SDK tries to hit Clerk's
//   /v1/client/sessions/{id}/end endpoint with a token for a non-existent
//   user — Clerk returns 401/404 and the SDK hangs or retries forever,
//   leaving the user stuck on "Signing out…".
//
// The real fix:
//   The session is already dead on Clerk's servers. We only need to clear the
//   browser-side cookies that encode the stale session. We nuke them via
//   document.cookie (covers non-HttpOnly ones like __client_uat which is the
//   key one middleware reads), then call /api/account/clear-session which sets
//   Max-Age=0 on the HttpOnly ones via Set-Cookie response headers.
//   Once done, window.location.replace("/") gives a clean server render with
//   zero Clerk state — no SDK round-trip, no hang.

"use client"

import { useEffect } from "react"

const CLERK_COOKIE_PREFIXES = [
  "__session",
  "__client_uat",
  "__refresh",
  "__clerk_db_jwt",
  "clerk_active_context",
  "__clerk",
]

function clearClerkCookiesFromDOM() {
  const cookies = document.cookie.split(";")
  for (const cookie of cookies) {
    const name = cookie.split("=")[0].trim()
    const isClerk = CLERK_COOKIE_PREFIXES.some(
      (prefix) => name === prefix || name.startsWith(`${prefix}_`)
    )
    if (isClerk) {
      // Expire across every path/domain variant Clerk may have set
      document.cookie = `${name}=; Max-Age=0; path=/`
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`
    }
  }
}

export default function SignedOutPage() {
  useEffect(() => {
    // 1. Nuke JS-accessible cookies immediately (catches __client_uat)
    clearClerkCookiesFromDOM()

    // 2. Hit the companion route to expire HttpOnly cookies via Set-Cookie headers.
    //    Fire-and-forget with .finally() — we navigate regardless, because the
    //    Clerk user no longer exists so any lingering HttpOnly token will be
    //    rejected by Clerk on its next use anyway.
    fetch("/api/account/clear-session", { method: "POST" }).finally(() => {
      // 3. Hard replace (not push) — discards /signed-out from browser history
      //    and forces a fresh server render of / with no Clerk cookies.
      window.location.replace("/")
    })
  }, [])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg)",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "14px",
          fontFamily: "DM Mono, monospace",
        }}
      >
        Clearing session…
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}