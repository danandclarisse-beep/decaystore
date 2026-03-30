import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Lower sample rate on server — high-volume API routes can flood your quota
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  // Ignore common non-actionable errors
  ignoreErrors: [
    "NEXT_NOT_FOUND",       // Next.js notFound() calls — expected, not bugs
    "NEXT_REDIRECT",        // Next.js redirect() calls — expected
    "AbortError",           // User navigated away mid-request
  ],
})