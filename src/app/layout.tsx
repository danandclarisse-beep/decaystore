import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"

export const metadata: Metadata = {
  title: "DecayStore — Storage with a memory",
  description:
    "Files that delete themselves when you stop caring. Intentional storage for intentional people.",
  metadataBase: new URL("https://decaystore.vercel.app"),
  openGraph: {
    title: "DecayStore — Storage with a memory",
    description: "Files that delete themselves when you stop caring.",
    type: "website",
    url: "https://decaystore.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "DecayStore",
    description: "Storage with a memory. Files decay when ignored.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

// themeColor must live in viewport export (Next.js 14+)
export const viewport: Viewport = {
  themeColor: "#0a0a0b",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* [P9-1] Apply saved theme before first paint to prevent flash */}
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
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}