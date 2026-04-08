import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: "DecayStore — Storage with a memory",
  description:
    "Intentional storage. Files decay when ignored — only what you use survives.",
  metadataBase: new URL("https://decaystore.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "DecayStore — Storage with a memory",
    description: "Files decay when ignored. Only what you use survives.",
    type: "website",
    url: "https://decaystore.vercel.app",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "DecayStore — Storage with a memory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DecayStore",
    description: "Storage with a memory. Files decay when ignored.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

// themeColor must live in viewport export (Next.js 14+)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#0a0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f0" },
  ],
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

          {/* [P9-1] Apply saved theme before first paint to prevent FOUC */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                var t = localStorage.getItem('ds-theme');
                if (t === 'light' || t === 'dark') {
                  document.documentElement.setAttribute('data-theme', t);
                } else {
                  var prefer = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', prefer);
                }
              } catch(e) {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            })();
          ` }} />

          {/* Google Analytics 4 — only injected when GA_ID env var is set.
              strategy="afterInteractive" loads after hydration so it never
              blocks the critical render path. */}
          {GA_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
              />
              <Script id="ga-init" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_ID}', {
                    page_path: window.location.pathname,
                    // Anonymise IPs — required for GDPR compliance
                    anonymize_ip: true,
                    // Disable ad personalisation signals
                    allow_google_signals: false,
                    allow_ad_personalization_signals: false,
                  });
                `}
              </Script>
            </>
          )}
        </head>
        <body>
          {children}
          {/* Vercel Analytics — page views and Web Vitals.
              Zero config, no cookies, GDPR-compliant out of the box. */}
          <Analytics />
          {/* Vercel Speed Insights — real user performance metrics (LCP, FID, CLS) */}
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}