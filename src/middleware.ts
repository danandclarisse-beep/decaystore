// ROUTE: Applied globally via Next.js middleware
// FILE:  src/middleware.ts
//
// FIXES APPLIED:
//   [Issue 1 — CRITICAL] Google OAuth / sign-in now checks waitlist status
//     after any successful Clerk authentication. Any authenticated user whose
//     email is not in the waitlist with status "signed_up" is redirected to
//     /waitlist. This closes the OAuth bypass entirely.
//   [Issue 9 — LOW] Token expiry DB update is now awaited instead of
//     fire-and-forget, so silent failures no longer leave stale "approved"
//     rows with expired tokens.
//
// BUG FIXES (post-patch pass):
//   [BUG A] The stale "// AFTER" comment left between `const { userId }` and
//     `if (userId)` was harmless syntactically but masked the real structural
//     problem during review. Removed.
//   [BUG B — BYPASS] `auth().protect()` in the unauthenticated else-branch was
//     never awaited AND its return value (a redirect Response) was never
//     returned from the middleware function. The middleware fell through and
//     served the protected route to unauthenticated users.
//     Fix: return the result of `auth.protect()` (clerkMiddleware passes `auth`
//     as the helper, not `auth()`) so the redirect is actually sent.
//   [BUG C — BYPASS] If `email` resolved to undefined (e.g. a Google account
//     whose primary address Clerk hasn't synced yet, or a Clerk user with no
//     email address), the entire waitlist check was silently skipped and the
//     user was granted access. An authenticated user with no resolvable email
//     must be denied, not passed through.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { waitlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/about",
  "/contact",
  "/legal(.*)",
  "/auth/sign-in(.*)",
  // /auth/sign-up intentionally removed — now requires a valid waitlist token
  "/api/webhooks(.*)",
  // Health check must be public — BetterStack (and any uptime monitor) pings
  // this without a Clerk session. The endpoint itself has no sensitive data.
  "/api/health",
  // [S8] /api/cron is intentionally public at the Clerk layer — Vercel's cron
  // caller has no Clerk session. The endpoint is protected by a CRON_SECRET
  // bearer token checked inside the handler.
  "/api/cron(.*)",
  "/waitlist",          // [P18] waitlist join page
  "/api/waitlist(.*)", // [P18] join + count + check-status are public
  // SSO callback must be public — Clerk redirects here after OAuth to finalise
  // the handshake. The page itself performs the waitlist check before redirecting
  // to /dashboard. If this route were protected, Clerk could not complete the flow.
  "/sso-callback",
  "/signed-out",                    // [P19] post-deletion landing — runs cookie purge, no session needed
  "/api/account/clear-session",     // [P19] expires HttpOnly Clerk cookies — intentionally unauthenticated
  // [ADMIN] Secret-gated admin pages — no Clerk session, protected by ADMIN_SECRET bearer token
  "/admin(.*)",
  "/api/admin(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl

  // [P19] Account-deletion guard ─────────────────────────────────────────────
  if (url.pathname === "/" && url.searchParams.get("deleted") === "1") {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL("/signed-out", req.url))
    }
    return NextResponse.redirect(new URL("/", req.url))
  }

  // [P18] Waitlist gate — block /auth/sign-up unless a valid token is present
  if (url.pathname.startsWith("/auth/sign-up")) {
    const bypass = process.env.BYPASS_WAITLIST === "true"

    if (!bypass) {
      const token = url.searchParams.get("token")

      if (!token) {
        return NextResponse.redirect(new URL("/waitlist", req.url))
      }

      const entry = await db.query.waitlist.findFirst({
        where: eq(waitlist.token, token),
      })

      if (!entry || entry.status !== "approved") {
        return NextResponse.redirect(new URL("/waitlist?error=invalid", req.url))
      }

      if (entry.tokenExpiresAt && entry.tokenExpiresAt < new Date()) {
        // [FIX Issue 9] Await the update so failures are not silently swallowed.
        try {
          await db.update(waitlist)
            .set({ status: "token_expired", token: null })
            .where(eq(waitlist.id, entry.id))
        } catch (err) {
          console.error("[middleware] Failed to mark token as expired:", err)
        }
        return NextResponse.redirect(new URL("/waitlist?error=expired", req.url))
      }

      // Valid token — let Clerk sign-up proceed. Token is consumed (nulled) in
      // getOrCreateUser() after the Clerk account is created.
    }
  }

  // [FIX Issue 1 — CRITICAL] Post-auth waitlist check ────────────────────────
  // Clerk's sign-in flow (including social OAuth) auto-creates a Clerk account
  // if one does not exist. The old code only checked the token at /auth/sign-up,
  // meaning any user could click "Continue with Google" on /auth/sign-in and land
  // on /dashboard without ever touching the waitlist gate.
  //
  // Fix: after any successful authentication on a protected route, verify that the
  // authenticated user's primary email has a waitlist entry with status "signed_up".
  // Any other status (pending, approved-but-not-signed-up, token_expired, or absent)
  // is redirected to /waitlist with a descriptive error code.
  //
  // This runs ONLY on non-public, authenticated routes — it does not add a DB query
  // to public pages or the sign-up/sign-in pages themselves.
  if (!isPublicRoute(req)) {
    const { userId } = await auth()

    if (userId) {
      // Use clerkClient instead of currentUser() — currentUser() is an App Router
      // server function that relies on React's request context and cannot be called
      // in Next.js middleware (Edge runtime). clerkClient().users.getUser() is the
      // correct way to fetch user data from middleware.
      const { clerkClient } = await import("@clerk/nextjs/server")
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const email = clerkUser?.emailAddresses[0]?.emailAddress

      // [BUG C FIX] Do NOT fall through if email is missing. An authenticated
      // user with no resolvable email cannot be verified against the waitlist
      // and must be blocked, not silently admitted.
      if (!email) {
        return NextResponse.redirect(new URL("/waitlist?error=not-approved", req.url))
      }

      const bypass = process.env.BYPASS_WAITLIST === "true"

      if (!bypass) {
        const entry = await db.query.waitlist.findFirst({
          where: eq(waitlist.email, email),
        })

      if (!entry || (entry.status !== "signed_up" && entry.status !== "approved")) {
        return NextResponse.redirect(new URL("/waitlist?error=not-approved", req.url))
      }

      if (entry.status === "approved") {
        // Token was validated at sign-up time. The user completed Clerk account
        // creation but getOrCreateUser() hasn't fired yet (first request race).
        // Transition them now so they aren't bounced on every request.
        if (entry.tokenExpiresAt && entry.tokenExpiresAt < new Date()) {
          await db.update(waitlist)
            .set({ status: "token_expired", token: null })
            .where(eq(waitlist.id, entry.id))
          return NextResponse.redirect(new URL("/waitlist?error=expired", req.url))
        }
        // Consume token and mark as signed_up — mirrors what getOrCreateUser() does.
        await db.update(waitlist)
          .set({ status: "signed_up", signedUpAt: new Date(), token: null })
          .where(eq(waitlist.id, entry.id))
        // Fall through — let the request proceed to /dashboard normally.
      }
      }
    } else {
      // [BUG B FIX] The old code called `auth().protect()` (a second auth() invocation),
      // never awaited it, and never returned its redirect Response — so unauthenticated
      // requests fell straight through to the protected route.
      //
      // `auth.protect()` does not exist on ClerkMiddlewareAuth. The correct pattern
      // inside clerkMiddleware is to redirect unauthenticated users to the sign-in
      // page manually, which is what Clerk's own protect() does internally anyway.
      const signInUrl = new URL("/auth/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}