import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"
import Link from "next/link"

export const metadata = {
  title: "About — DecayStore",
  description: "The story behind DecayStore and why we built intentional file storage.",
}

export default function AboutPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <main className="max-w-2xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
          >
            About
          </p>
          <h1 className="text-5xl font-bold mb-6">Why does this exist?</h1>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
            We built DecayStore because we were tired of cloud storage that never forgets.
            Dropboxes full of files from 2017. Google Drives that balloon endlessly.
            Storage you pay for but never audit.
          </p>
        </div>

        <div
          className="rounded-2xl p-7 mb-10"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-2xl font-bold mb-4 leading-snug"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
          >
            "If you haven't touched a file in 30 days, do you really need it?"
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            DecayStore forces you to answer that question — automatically.
          </p>
        </div>

        <div className="space-y-6 text-base leading-relaxed mb-14" style={{ color: "var(--text-muted)" }}>
          <p>
            The concept is simple: every file you upload starts a decay clock. The clock resets
            every time you access the file. If you never access it, it slowly reaches 100% decay
            and is permanently deleted.
          </p>
          <p>
            This isn't punishment — it's intentionality. The files you care about naturally survive
            because you use them. The files you've forgotten disappear quietly, just like they should.
          </p>
          <p>
            We're a small team of developers who got tired of paying $15/month for storage full of
            files we'd never open again. DecayStore is the tool we built for ourselves.
          </p>
        </div>

        <div
          className="rounded-2xl p-7 mb-10"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-xl font-bold mb-5">Tech stack</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Framework", "Next.js 14 (App Router)"],
              ["Auth",      "Clerk"                  ],
              ["Database",  "Neon (Postgres)"        ],
              ["Storage",   "Cloudflare R2"          ],
              ["Billing",   "LemonSqueezy"           ],
              ["Email",     "Resend"                 ],
              ["Hosting",   "Vercel"                 ],
              ["ORM",       "Drizzle"                ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                  {label}
                </span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <Link href="/auth/sign-up" className="btn-accent px-5 py-2.5 rounded-xl text-sm">
            Try it free
          </Link>
          <Link href="/contact" className="btn-outline px-5 py-2.5 rounded-xl text-sm">
            Get in touch
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}