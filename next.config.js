// [Monitoring] Sentry wraps the Next.js config to inject its webpack plugin.
// This enables source map uploads, performance tracing, and error capture.
// The withSentryConfig call must be the outermost wrapper.
const { withSentryConfig } = require("@sentry/nextjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // [S5] Removed serverActions.bodySizeLimit: '100mb' — uploads go directly
  // to R2 via presigned URLs so the Next.js server never handles file bytes.
  // The default 1 MB Server Action limit is correct and reduces DoS surface.

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },

  // [S2] HTTP security headers applied to every route.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the page being embedded in an iframe (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers MIME-sniffing responses away from declared content-type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Restrict referrer info to same-origin only
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable unnecessary browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Force HTTPS for 1 year; include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          // Domains added for monitoring:
          // - Sentry:          https://*.sentry.io (connect-src for error/trace ingestion)
          //                    https://browser.sentry-cdn.com (script-src for Sentry SDK)
          // - Google Analytics: https://www.googletagmanager.com (script-src, connect-src)
          //                     https://www.google-analytics.com (connect-src, img-src)
          //                     https://*.analytics.google.com (connect-src)
          // - BetterStack:     No client-side script — server-only log drain, no CSP changes needed
          // - Vercel Analytics: https://va.vercel-scripts.com (script-src, connect-src)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Clerk + Cloudflare CAPTCHA + Sentry SDK + GTM + Vercel Analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.decaystore.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://browser.sentry-cdn.com https://www.googletagmanager.com https://va.vercel-scripts.com",
              // Clerk + Cloudflare Turnstile Web Workers
              "worker-src blob: https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // blob: for canvas previews, img.clerk.com for avatars, GA pixel
              "img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://img.clerk.com https://www.google-analytics.com",
              // R2 presigned URLs for audio/video preview
              "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
              // Clerk iframes + Cloudflare CAPTCHA iframe + R2 preview
              "frame-src https://clerk.decaystore.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com",
              // R2 for PDF embed (Chrome fallback)
              "object-src https://*.r2.cloudflarestorage.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Clerk + Cloudflare + R2 + Sentry ingestion + GA + Vercel Analytics
              "connect-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com https://*.sentry.io https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://va.vercel-scripts.com",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Sentry organisation and project — set these in your environment or here directly
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry on every production build so stack traces
  // show your original TypeScript, not the minified output.
  // Source maps are deleted from the build output after upload — they never
  // ship to the browser.
  silent: true, // Suppress Sentry CLI output during build
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry debug code in production
  disableLogger: true,

  // Wrap API route handlers automatically for better error context
  automaticVercelMonitors: true,
})