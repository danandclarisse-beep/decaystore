"use client"

import Link from "next/link"
import { SignedIn, SignedOut } from "@clerk/nextjs"
import type { PlanKey } from "@/lib/plans"

interface Props {
  /** Passed from server components that already have the user's plan.
   *  null = unknown (client-side Clerk state only, e.g. on non-DB pages). */
  userPlan?: PlanKey | null
}

// ── Nav link sets by auth state ──────────────────────────
const ANON_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about",   label: "About"   },
  { href: "/contact", label: "Contact" },
]

// Free users still see Pricing as an upgrade nudge
const FREE_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/guide",   label: "Guide"   },
  { href: "/account", label: "Account" },
]

// Starter/Pro users: guide only (pricing de-emphasised; lives in footer)
const PAID_LINKS = [
  { href: "/guide",   label: "Guide"   },
  { href: "/account", label: "Account" },
]

export function Nav({ userPlan }: Props = {}) {
  // Determine which centre-links to render.
  // We use Clerk's <SignedIn>/<SignedOut> for auth boundary,
  // and the passed userPlan prop to pick the right link set.
  function centreLinks(isSignedIn: boolean): typeof ANON_LINKS {
    if (!isSignedIn) return ANON_LINKS
    if (!userPlan || userPlan === "free") return FREE_LINKS
    return PAID_LINKS
  }

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "rgba(10,10,11,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            D
          </span>
          <span
            className="font-bold text-lg tracking-tight"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            DecayStore
          </span>
        </Link>

        {/* Centre links — anonymous */}
        <SignedOut>
          <div className="hidden md:flex items-center gap-6">
            {ANON_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link text-sm">
                {l.label}
              </Link>
            ))}
          </div>
        </SignedOut>

        {/* Centre links — signed in */}
        <SignedIn>
          <div className="hidden md:flex items-center gap-6">
            {centreLinks(true).map((l) => (
              <Link key={l.href} href={l.href} className="nav-link text-sm">
                {l.label}
              </Link>
            ))}
          </div>
        </SignedIn>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <SignedOut>
            <Link href="/auth/sign-in" className="btn-ghost text-sm px-4 py-2 rounded-lg">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="btn-accent text-sm px-4 py-2 rounded-lg">
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-accent text-sm px-4 py-2 rounded-lg">
              Dashboard →
            </Link>
          </SignedIn>
        </div>
      </div>
    </nav>
  )
}
