"use client"

import Link from "next/link"
import { SignedIn, SignedOut } from "@clerk/nextjs"

export function Nav() {
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

        {/* Center links */}
        <div className="hidden md:flex items-center gap-6">
          {[
            { href: "/pricing", label: "Pricing" },
            { href: "/about",   label: "About"   },
            { href: "/contact", label: "Contact" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="nav-link text-sm">
              {l.label}
            </Link>
          ))}
        </div>

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