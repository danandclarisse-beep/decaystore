/** @type {import('next').NextConfig} */
const nextConfig = {
  // [S5] Removed serverActions.bodySizeLimit: '100mb' — uploads go directly
  // to R2 via presigned URLs so the Next.js server never handles file bytes.
  // The default 1 MB Server Action limit is correct and reduces DoS surface.

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },

  // [S2] HTTP security headers applied to every route.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent the page being embedded in an iframe (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop browsers MIME-sniffing responses away from declared content-type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Restrict referrer info to same-origin only
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Force HTTPS for 1 year; include subdomains
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          // - default-src 'self': block all unlisted sources by default
          // - script-src: allow self + Next.js inline runtime + Clerk hosted scripts
          // - style-src: allow self + inline styles (Tailwind/CSS-in-JS)
          // - img-src: allow self + R2 public URLs + data URIs (avatars)
          // - connect-src: allow self + Clerk API + R2 upload endpoint
          // - frame-src: allow Clerk hosted UI iframes
          // - font-src: allow self + Google Fonts (Syne / DM Sans / DM Mono)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.decaystore.com https://*.clerk.accounts.dev",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https://*.r2.dev https://img.clerk.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.clerk.accounts.dev https://*.r2.cloudflarestorage.com",
              "frame-src https://clerk.decaystore.com https://*.clerk.accounts.dev",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig