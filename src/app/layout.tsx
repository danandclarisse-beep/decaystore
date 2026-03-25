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
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}