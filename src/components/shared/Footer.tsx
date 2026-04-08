import Link from "next/link"
import { LogoMark } from "@/components/shared/LogoMark"

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark size={28} />
              <span className="font-bold text-base" style={{ fontFamily: "Syne, sans-serif" }}>
                DecayStore
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Storage with a memory. Files that don&rsquo;t get used don&rsquo;t get kept.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
              Product
            </p>
            <ul className="space-y-2.5">
              {[
                { label: "Pricing",   href: "/pricing"   },
                { label: "Dashboard", href: "/dashboard" },
                { label: "About",     href: "/about"     },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="footer-link">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
              Legal
            </p>
            <ul className="space-y-2.5">
              {[
                { label: "Privacy Policy", href: "/legal/privacy" },
                { label: "Terms of Service", href: "/legal/terms" },
                { label: "Cookie Policy",  href: "/legal/cookies" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="footer-link">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
              Support
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/contact" className="footer-link">Contact Us</Link>
              </li>
              <li>
                <a
                  href="https://status.decaystore.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  Status
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            © {year} DecayStore. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Built with Next.js · Powered by Cloudflare R2
          </p>
        </div>
      </div>
    </footer>
  )
}