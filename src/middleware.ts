import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/about",
  "/contact",
  "/legal(.*)",
  "/auth/sign-in(.*)",
  "/auth/sign-up(.*)",
  "/api/webhooks(.*)",
  // [S8] /api/cron is intentionally public at the Clerk layer — Vercel's cron
  // caller has no Clerk session. The endpoint is protected by a CRON_SECRET
  // bearer token checked inside the handler. As an additional defence-in-depth
  // measure, consider adding a Vercel firewall rule to restrict this path to
  // Vercel's documented cron egress IPs:
  // https://vercel.com/docs/security/deployment-protection/methods-to-protect-deployments/vercel-firewall
  "/api/cron(.*)",
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}