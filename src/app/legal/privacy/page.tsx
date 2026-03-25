import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export const metadata = {
  title: "Privacy Policy — DecayStore",
  description: "How DecayStore collects, uses, and protects your data.",
}

const LAST_UPDATED = "March 1, 2025"

export default function PrivacyPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      <main className="max-w-2xl mx-auto px-6 py-20">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
        >
          Legal
        </p>
        <h1 className="text-5xl font-bold mb-3">Privacy Policy</h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose-custom space-y-10">
          <Section title="1. Introduction">
            <p>
              DecayStore ("we", "us", or "our") operates the DecayStore service (the "Service").
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our Service. Please read this policy carefully. By using
              the Service, you agree to the collection and use of information in accordance with
              this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following types of information:</p>
            <SubList items={[
              { label: "Account data", body: "Name, email address, and authentication credentials managed via Clerk." },
              { label: "File metadata", body: "File names, sizes, MIME types, upload timestamps, and access timestamps. We do not scan or read the contents of your files." },
              { label: "Usage data", body: "Pages visited, features used, and interactions with the Service for analytics and improvement purposes." },
              { label: "Billing data", body: "Payment processing is handled entirely by Stripe. We do not store your credit card or payment information." },
              { label: "Communications", body: "Emails you send to us, and emails we send you (decay warnings, account notifications)." },
            ]} />
          </Section>

          <Section title="3. How We Use Your Information">
            <SubList items={[
              { label: "Service delivery", body: "To provide, maintain, and improve the Service, including storing and retrieving your files." },
              { label: "Decay notifications", body: "To send you email warnings when your files reach decay thresholds." },
              { label: "Billing", body: "To process subscription payments and manage your plan via Stripe." },
              { label: "Security", body: "To detect, investigate, and prevent fraudulent transactions and other illegal activities." },
              { label: "Legal compliance", body: "To comply with applicable laws and regulations." },
            ]} />
          </Section>

          <Section title="4. File Storage & Security">
            <p>
              Your files are stored on Cloudflare R2 object storage, hosted in Cloudflare's global
              network. Files are private by default and only accessible via time-limited presigned
              URLs that expire after 1 hour. We do not share your files with third parties.
            </p>
            <p className="mt-3">
              We implement industry-standard security measures including HTTPS encryption in
              transit and at-rest encryption in Cloudflare R2. However, no method of transmission
              over the Internet is 100% secure.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              Files are retained until they reach 100% decay and are automatically deleted, or
              until you manually delete them. Account data is retained for as long as your account
              is active. Upon account deletion, all files and associated data are permanently
              removed within 30 days.
            </p>
          </Section>

          <Section title="6. Third-Party Services">
            <p>We use the following third-party services, each with their own privacy policies:</p>
            <SubList items={[
              { label: "Clerk", body: "Authentication and identity management. clerk.com/privacy" },
              { label: "Neon", body: "Database hosting. neon.tech/privacy" },
              { label: "Cloudflare R2", body: "File storage. cloudflare.com/privacypolicy" },
              { label: "Stripe", body: "Payment processing. stripe.com/privacy" },
              { label: "Resend", body: "Transactional email. resend.com/privacy" },
              { label: "Vercel", body: "Hosting and edge network. vercel.com/legal/privacy-policy" },
            ]} />
          </Section>

          <Section title="7. Your Rights (GDPR / CCPA)">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--text-muted)", paddingLeft: "1.2rem", listStyleType: "disc" }}>
              {[
                "Access the personal data we hold about you",
                "Request correction of inaccurate data",
                "Request deletion of your data",
                "Object to or restrict processing",
                "Data portability",
                "Withdraw consent at any time",
              ].map(r => <li key={r}>{r}</li>)}
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:legal@decaystore.com" style={{ color: "var(--accent)" }}>
                legal@decaystore.com
              </a>.
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use essential cookies for authentication (managed by Clerk) and session
              management. We do not use advertising or tracking cookies. See our{" "}
              <a href="/legal/cookies" style={{ color: "var(--accent)" }}>Cookie Policy</a>{" "}
              for full details.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              The Service is not directed at children under 13. We do not knowingly collect
              personal information from children under 13. If you believe we have inadvertently
              collected such information, contact us immediately at legal@decaystore.com.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              significant changes by email or a prominent notice on the Service. Your continued
              use of the Service after changes are posted constitutes your acceptance of the
              updated policy.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              If you have questions about this Privacy Policy, contact us at{" "}
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
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  )
}

function SubList({ items }: { items: { label: string; body: string }[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map(item => (
        <li key={item.label} className="flex gap-2">
          <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>→</span>
          <span>
            <strong style={{ color: "var(--text)" }}>{item.label}:</strong>{" "}
            {item.body}
          </span>
        </li>
      ))}
    </ul>
  )
}