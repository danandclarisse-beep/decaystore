import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"

export const metadata = {
  title: "Terms of Service — DecayStore",
  description: "DecayStore's Terms of Service.",
}

const LAST_UPDATED = "March 1, 2025"

export default function TermsPage() {
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
        <h1 className="text-5xl font-bold mb-3">Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using DecayStore ("the Service"), you agree to be bound by these
              Terms of Service ("Terms"). If you do not agree, do not use the Service. These
              Terms apply to all users, including visitors, free users, and paid subscribers.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              DecayStore provides cloud file storage with an automated decay-and-deletion system.
              Files that are not accessed within a plan-defined window are automatically and
              permanently deleted. This is a core feature, not a bug.
            </p>
            <p className="mt-3 p-4 rounded-xl font-medium" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--accent)" }}>
              ⚠️ Important: Deleted files cannot be recovered. You are solely responsible for
              maintaining backups of any files you upload to the Service.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p>
              You must create an account to use the Service. You agree to provide accurate,
              current, and complete information. You are responsible for maintaining the
              confidentiality of your account credentials and for all activity under your account.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use the Service to upload, store, or share:</p>
            <ul className="mt-3 space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
              {[
                "Content that is illegal under applicable law",
                "Child sexual abuse material (CSAM) or any content that exploits minors",
                "Malware, viruses, or other malicious code",
                "Content that infringes on third-party intellectual property rights",
                "Personally identifiable information of others without their consent",
                "Content that violates any third-party rights",
              ].map(item => <li key={item}>{item}</li>)}
            </ul>
            <p className="mt-4">
              We reserve the right to terminate accounts that violate these terms without notice.
            </p>
          </Section>

          <Section title="5. Storage & File Deletion">
            <p>
              Each plan includes a storage limit and a decay window (the number of days before
              an unaccessed file is deleted). You acknowledge and agree that:
            </p>
            <ul className="mt-3 space-y-1.5 pl-5" style={{ listStyleType: "disc" }}>
              <li>Files are automatically and permanently deleted when they reach 100% decay.</li>
              <li>Deleted files cannot be recovered by you or by DecayStore.</li>
              <li>You will receive email warnings before deletion.</li>
              <li>It is your sole responsibility to access or renew files you wish to keep.</li>
              <li>DecayStore is not liable for any loss of data due to the decay system.</li>
            </ul>
          </Section>

          <Section title="6. Payment & Subscriptions">
            <p>
              Paid plans are billed monthly via Stripe. Subscriptions automatically renew unless
              cancelled. You may cancel at any time via the billing portal; cancellation takes
              effect at the end of the current billing period. We do not offer refunds except
              within 7 days of the initial subscription date.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              You retain all ownership rights to files you upload. By uploading, you grant
              DecayStore a limited, non-exclusive license to store and serve your files solely
              for the purpose of providing the Service. We do not claim ownership of your content.
            </p>
          </Section>

          <Section title="8. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL
              WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DECAYSTORE SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
              DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED
              THE AMOUNT PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We may suspend or terminate your account at any time for violations of these Terms.
              You may delete your account at any time from the dashboard. Upon termination, your
              files will be deleted within 30 days.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              We may update these Terms at any time. Material changes will be communicated by
              email or in-app notice. Continued use of the Service after changes constitutes
              acceptance.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These Terms are governed by the laws of the jurisdiction in which DecayStore is
              registered, without regard to conflict-of-law provisions. Any disputes shall be
              resolved in the courts of that jurisdiction.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
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