// ROUTE: POST /api/account/clear-session
// FILE:  src/app/api/account/clear-session/route.ts
//
// [P19] HttpOnly cookie purge endpoint.
//
// document.cookie in the browser cannot touch HttpOnly cookies. This endpoint
// exists solely to expire them server-side via Set-Cookie: Max-Age=0 response
// headers. It is called by /signed-out immediately after the JS-accessible
// cookies are cleared client-side.
//
// No auth check required — the Clerk user is already deleted by this point,
// so any auth() call would return null. The endpoint is intentionally
// unauthenticated: the worst an attacker could do is expire their own Clerk
// cookies, which is harmless.

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const CLERK_COOKIE_PREFIXES = [
  "__session",
  "__client_uat",
  "__refresh",
  "__clerk_db_jwt",
  "clerk_active_context",
  "__clerk",
]

export async function POST() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const response = NextResponse.json({ ok: true })

  for (const cookie of allCookies) {
    const isClerk = CLERK_COOKIE_PREFIXES.some(
      (prefix) => cookie.name === prefix || cookie.name.startsWith(`${prefix}_`)
    )
    if (isClerk) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
    }
  }

  return response
}