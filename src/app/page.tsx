import Link from "next/link"
import { SignedIn, SignedOut } from "@clerk/nextjs"
import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export default function HomePage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(245,166,35,0.08) 0%, transparent 70%)" }}
        />
        <div className="max-w-5xl mx-auto px-6 pt-28 pb-24 text-center relative">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid rgba(245,166,35,0.2)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: "var(--accent)" }} />
            Files that forget themselves
          </div>

          <h1
            className="text-6xl sm:text-7xl font-bold mb-6"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.03em", lineHeight: 1.05 }}
          >
            Storage with
            <br />
            <span style={{ color: "var(--accent)" }}>a memory.</span>
          </h1>

          <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Files you ignore slowly decay and delete themselves.
            Files you care about, you renew. No hoarding. No clutter.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SignedOut>
              <Link href="/auth/sign-up" className="btn-accent px-6 py-3 rounded-xl text-sm">
                Start for free →
              </Link>
              <Link href="/pricing" className="btn-outline px-6 py-3 rounded-xl text-sm">
                See pricing
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn-accent px-6 py-3 rounded-xl text-sm">
                Go to dashboard →
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Decay visualizer */}
      <section className="max-w-2xl mx-auto px-6 py-4 mb-16">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-medium" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
              decay_preview.tsx
            </p>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444", opacity: 0.6 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24", opacity: 0.6 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399", opacity: 0.6 }} />
            </div>
          </div>
          <div className="space-y-4">
            {[
              { name: "project-brief.pdf", score: 0.05, label: "Fresh",    color: "#34d399", days: 28 },
              { name: "old-mockups.fig",   score: 0.52, label: "Aging",    color: "#fbbf24", days: 14 },
              { name: "draft-v1.docx",     score: 0.78, label: "Critical", color: "#f97316", days: 6  },
              { name: "2021-receipts.zip", score: 0.96, label: "Expiring", color: "#ef4444", days: 1  },
            ].map((file) => (
              <div key={file.name} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs ml-4 shrink-0" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                      {file.days}d
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${file.score * 100}%`, background: file.color }}
                    />
                  </div>
                </div>
                <span
                  className="text-xs font-semibold w-14 text-right shrink-0"
                  style={{ color: file.color, fontFamily: "DM Mono, monospace" }}
                >
                  {file.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }} className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
            How it works
          </p>
          <h2 className="text-3xl font-bold text-center mb-16">Three steps. No hoarding.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Upload your files",   body: "Drop any file. It starts fresh with a full decay clock — no urgency yet." },
              { step: "02", title: "Decay starts ticking", body: "Every day you don't access a file, its decay score rises. Email warnings before it's gone." },
              { step: "03", title: "Renew or lose it",    body: "Open a file to reset its clock. Ignore it and it disappears. Your intent, made permanent." },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl p-6"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <p className="text-3xl font-bold mb-4" style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace", opacity: 0.5 }}>
                  {item.step}
                </p>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: "⚡", title: "Direct-to-R2 uploads",   body: "Files go browser → Cloudflare R2 directly. No server bottleneck. Supports files up to 5 GB." },
            { icon: "📧", title: "Email decay warnings",   body: "Get warned at 50%, 90%, and right before deletion. Never lose a file by surprise." },
            { icon: "🔒", title: "Secure by default",      body: "All files are private. Presigned URLs expire in 1 hour. Zero public exposure by default." },
            { icon: "💸", title: "Zero egress cost",       body: "Powered by Cloudflare R2 — no bandwidth fees ever, no matter how many times you download." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6 flex gap-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to declutter?</h2>
          <p className="text-base mb-8" style={{ color: "var(--text-muted)" }}>
            Free plan includes 1 GB and 10 files. No credit card required.
          </p>
          <Link href="/auth/sign-up" className="btn-accent inline-block px-8 py-3.5 rounded-xl text-sm">
            Start for free — no credit card
          </Link>
          <p className="text-xs mt-4" style={{ color: "var(--text-dim)" }}>
            By signing up you agree to our{" "}
            <Link href="/legal/terms" className="underline underline-offset-2" style={{ color: "var(--text-muted)" }}>Terms of Service</Link>
            {" "}and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2" style={{ color: "var(--text-muted)" }}>Privacy Policy</Link>.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}