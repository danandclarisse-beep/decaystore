import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of transactions in dev, 10% in production
  // Adjust tracesSampleRate down as traffic grows
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture 10% of sessions for replay in production
  // Replays show exactly what a user did before an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // Always capture replay on error

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media by default — privacy first
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Only send errors in production — suppress noise during development
  enabled: process.env.NODE_ENV === "production",

  // Tag every event with the environment
  environment: process.env.NODE_ENV,
})