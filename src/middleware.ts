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
  "/waitlist",           // [P18] waitlist join page
  "/api/waitlist(.*)",  // [P18] join + count are public
  "/signed-out",                      // [P19] post-deletion landing — runs cookie purge, no session needed
  "/api/account/clear-session",       // [P19] expires HttpOnly Clerk cookies — intentionally unauthenticated
  // [ADMIN] Secret-gated admin pages — no Clerk session, protected by ADMIN_SECRET bearer token
  "/admin(.*)",
  "/api/admin(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl

  // [P19] Account-deletion guard ─────────────────────────────────────────────
  // After account deletion, the client navigates to /?deleted=1. If Clerk's
  // client-side SDK hasn't fully cleared the session yet (race condition between
  // cookie expiry on the API response and the next server render), the middleware
  // may see an active session for a user that no longer exists in Clerk or DB.
  // Intercept at the edge: if a session is still live, redirect to /signed-out
  // which calls useClerk().signOut() on the client to fully purge Clerk state.
  if (url.pathname === "/" && url.searchParams.get("deleted") === "1") {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL("/signed-out", req.url))
    }
    // No active session — strip the query param so the homepage renders cleanly
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
        // Mark expired — fire-and-forget so we don't block the redirect
        db.update(waitlist)
          .set({ status: "token_expired", token: null })
          .where(eq(waitlist.id, entry.id))
          .catch(console.error)
        return NextResponse.redirect(new URL("/waitlist?error=expired", req.url))
      }

      // Valid token — let Clerk sign-up proceed.
      // After account creation a post-signup step should set
      // created_via = 'waitlist' and signed_up_at on the waitlist row.
    }
  }

  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}