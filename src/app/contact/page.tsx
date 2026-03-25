import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export const metadata = {
  title: "Contact — DecayStore",
  description: "Get in touch with the DecayStore team.",
}

export default function ContactPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <main className="max-w-2xl mx-auto px-6 py-20">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
        >
          Contact
        </p>
        <h1 className="text-5xl font-bold mb-4">Get in touch</h1>
        <p className="text-base mb-12 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          We're a small team and we read every message. Typically respond within 1 business day.
        </p>

        <div className="space-y-4 mb-14">
          {[
            {
              icon: "✉️",
              title: "General inquiries",
              description: "Questions about DecayStore, feedback, or anything else.",
              contact: "hello@decaystore.com",
              href: "mailto:hello@decaystore.com",
            },
            {
              icon: "🛠️",
              title: "Technical support",
              description: "Issues with uploads, billing problems, account access.",
              contact: "support@decaystore.com",
              href: "mailto:support@decaystore.com",
            },
            {
              icon: "⚖️",
              title: "Legal & privacy",
              description: "Data requests, GDPR, takedown notices, legal matters.",
              contact: "legal@decaystore.com",
              href: "mailto:legal@decaystore.com",
            },
            {
              icon: "💼",
              title: "Business & partnerships",
              description: "Enterprise plans, API access, integration partnerships.",
              contact: "partnerships@decaystore.com",
              href: "mailto:partnerships@decaystore.com",
            },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="card-hover flex items-start gap-4 rounded-xl p-5"
            >
              <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-sm mb-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {item.description}
                </p>
                <p className="text-sm font-medium" style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace" }}>
                  {item.contact}
                </p>
              </div>
              <span className="text-lg" style={{ color: "var(--text-dim)" }}>→</span>
            </a>
          ))}
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>Response times:</strong> Support emails are
            answered within 24 hours on business days (Mon–Fri). For urgent billing issues,
            include "URGENT" in your subject line. We do not offer phone support at this time.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}