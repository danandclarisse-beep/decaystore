import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export const metadata = {
  title: "Cookie Policy — DecayStore",
  description: "How DecayStore uses cookies.",
}

export default function CookiePolicyPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
          Legal
        </p>
        <h1 className="text-5xl font-bold mb-3">Cookie Policy</h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
          Last updated: March 1, 2025
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <Section title="What are cookies?">
            <p>
              Cookies are small text files stored on your device by your browser when you visit
              a website. They allow the site to remember your preferences and authenticate your
              session across requests.
            </p>
          </Section>

          <Section title="Cookies we use">
            <p>DecayStore uses only <strong style={{ color: "var(--text)" }}>essential cookies</strong>. We do not use advertising, tracking, or analytics cookies.</p>
            <div className="mt-5 space-y-3">
              {[
                { name: "__session (Clerk)", purpose: "Authentication session token managed by Clerk. Required for login.", type: "Essential", duration: "Session / 1 year" },
                { name: "__clerk_db_jwt", purpose: "Clerk database JWT for verifying your authentication state.", type: "Essential", duration: "Session" },
                { name: "__stripe_mid / __stripe_sid", purpose: "Stripe's fraud prevention cookies, set during checkout.", type: "Essential", duration: "1 year / 30 min" },
              ].map(cookie => (
                <div
                  key={cookie.name}
                  className="rounded-xl p-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <p className="font-semibold mb-1" style={{ color: "var(--text)", fontFamily: "DM Mono, monospace", fontSize: "13px" }}>
                    {cookie.name}
                  </p>
                  <p className="mb-2">{cookie.purpose}</p>
                  <div className="flex gap-4 text-xs" style={{ color: "var(--text-dim)" }}>
                    <span>Type: <strong style={{ color: "var(--text-muted)" }}>{cookie.type}</strong></span>
                    <span>Duration: <strong style={{ color: "var(--text-muted)" }}>{cookie.duration}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Cookies we do NOT use">
            <ul className="space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
              {[
                "Advertising or retargeting cookies",
                "Third-party analytics (Google Analytics, Mixpanel, etc.)",
                "Social media tracking pixels",
                "Cross-site tracking of any kind",
              ].map(item => <li key={item}>{item}</li>)}
            </ul>
          </Section>

          <Section title="Managing cookies">
            <p>
              You can control cookies through your browser settings. Disabling essential cookies
              will prevent you from logging in and using the Service. Since we only use essential
              cookies, there is no opt-out for non-essential cookies — there are none.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email us at{" "}
              <a href="mailto:legal@decaystore.com" style={{ color: "var(--accent)" }}>
                legal@decaystore.com
              </a>.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>{title}</h2>
      <div>{children}</div>
    </div>
  )
}