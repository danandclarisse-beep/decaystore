"use client"

import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { useState } from "react"
import {
  Loader2Icon,
  AlertCircleIcon,
  XIcon,
  MoreHorizontalIcon,
  CreditCardIcon,
  ZapIcon,
  LifeBuoyIcon,
} from "lucide-react"
import { NotificationBell } from "@/components/dashboard/NotificationBell"
import type { User } from "@/lib/db/schema"
import type { Notification } from "@/hooks/useNotifications"

interface Props {
  user: User | null
  notifications: Notification[]
  unreadCount: number
  onDismissNotif: (id: string) => void
  onDismissAllNotifs: () => void
  onMarkAllRead: () => void
}

export function DashboardHeader({
  user,
  notifications,
  unreadCount,
  onDismissNotif,
  onDismissAllNotifs,
  onMarkAllRead,
}: Props) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function openBillingPortal() {
    setPortalLoading(true)
    setPortalError(null)
    setMobileMenuOpen(false)

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setPortalError(data.error ?? "Could not open billing portal. Please try again.")
      }
    } catch {
      setPortalError("Network error. Please check your connection and try again.")
    } finally {
      setPortalLoading(false)
    }
  }

  // Force navigation fallback
  const forceNavigate = (href: string) => {
    window.location.href = href
  }

  const planBadge = {
    free: { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" },
    starter: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa" },
    pro: { bg: "rgba(245,166,35,0.12)", color: "var(--accent)" },
  }[user?.plan ?? "free"]

  const firstName = user
    ? (() => {
        const email = (user as unknown as { email?: string }).email
        return email ? email.split("@")[0].split(".")[0] : null
      })()
    : null

  return (
    <>
      <header
        style={{
          background: "rgba(10,10,11,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
        className="sticky top-0 z-[90] isolate pointer-events-auto"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          {/* Left — logo + plan badge */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              prefetch={false}
              onClick={(e) => {
                // Extra safety: force hard navigation if we're not on root
                if (window.location.pathname !== "/") {
                  e.preventDefault()
                  forceNavigate("/")
                }
              }}
              className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity pointer-events-auto"
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                D
              </span>
              <span
                className="font-bold text-base hidden sm:block"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                DecayStore
              </span>
            </Link>

            {user && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0"
                style={{
                  background: planBadge.bg,
                  color: planBadge.color,
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {user.plan}
              </span>
            )}
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-2">
            {firstName && (
              <span className="text-sm hidden md:block" style={{ color: "var(--text-muted)" }}>
                Hi, <span style={{ color: "var(--text)" }}>{firstName}</span>
              </span>
            )}

            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onDismiss={onDismissNotif}
              onDismissAll={onDismissAllNotifs}
              onMarkAllRead={onMarkAllRead}
              variant="header"
            />

            {/* Support button — Starter + Pro */}
            {(user?.plan === "starter" || user?.plan === "pro") && (
              <a
                href={`mailto:support@decaystore.com?subject=${encodeURIComponent(`[${user.plan.toUpperCase()}] Support request`)}&body=${encodeURIComponent(`Account: ${(user as unknown as { email?: string }).email ?? ""}\nPlan: ${user.plan}\n\nDescribe your issue:\n`)}`}
                className="text-xs px-3 py-1.5 rounded-lg hidden sm:flex items-center gap-1.5 hover:opacity-85 transition-all pointer-events-auto"
                style={{
                  color:      "var(--text-muted)",
                  border:     "1px solid var(--border)",
                  background: "var(--bg-card)",
                }}
                title={user.plan === "pro" ? "Priority support — 24h response" : "Support — 48h response"}
              >
                <LifeBuoyIcon className="w-3 h-3" />
                Support
              </a>
            )}

            {/* Upgrade button */}
            {user?.plan === "free" && (
              <button
                onClick={() => forceNavigate("/pricing")}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hidden sm:flex items-center gap-1.5 hover:opacity-85 active:opacity-75 pointer-events-auto"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                <ZapIcon className="w-3 h-3" />
                Upgrade
              </button>
            )}

            {/* Billing button */}
            {user?.billingCustomerId && (
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="text-xs px-3 py-1.5 rounded-lg hidden sm:flex items-center gap-1.5 disabled:opacity-60 transition-all hover:text-[var(--text)] hover:border-[var(--text-muted)] active:bg-[var(--bg-hover)] pointer-events-auto"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                }}
              >
                {portalLoading && <Loader2Icon className="w-3 h-3 animate-spin" />}
                {portalLoading ? "Loading…" : "Billing"}
              </button>
            )}

            {/* Mobile overflow menu */}
            <div className="relative sm:hidden z-[110]">
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[var(--bg-hover)] transition-colors pointer-events-auto"
                aria-label="More options"
              >
                <MoreHorizontalIcon className="w-4 h-4" />
              </button>

              {mobileMenuOpen && (
                <>
                  {/* Overlay */}
                  <div
                    className="fixed inset-0 z-[105] bg-black/20"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  {/* Menu */}
                  <div
                    className="absolute right-0 top-full mt-2 z-[110] rounded-xl overflow-hidden py-1"
                    style={{
                      minWidth: 180,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    }}
                  >
                    {firstName && (
                      <div
                        className="px-4 py-2.5 text-xs border-b"
                        style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}
                      >
                        Signed in as <span style={{ color: "var(--text)" }}>{firstName}</span>
                      </div>
                    )}

                    {(user?.plan === "starter" || user?.plan === "pro") && (
                      <a
                        href={`mailto:support@decaystore.com?subject=${encodeURIComponent(`[${user.plan.toUpperCase()}] Support request`)}&body=${encodeURIComponent(`Account: ${(user as unknown as { email?: string }).email ?? ""}\nPlan: ${user.plan}\n\nDescribe your issue:\n`)}`}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm w-full transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text)" }}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LifeBuoyIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        Support {user.plan === "pro" ? "(24h)" : "(48h)"}
                      </a>
                    )}

                    {user?.plan === "free" && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false)
                          forceNavigate("/pricing")
                        }}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm w-full transition-colors hover:bg-[var(--bg-hover)] text-[var(--accent)]"
                      >
                        <ZapIcon className="w-4 h-4" />
                        Upgrade plan
                      </button>
                    )}

                    {user?.billingCustomerId && (
                      <button
                        onClick={openBillingPortal}
                        disabled={portalLoading}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm w-full text-left transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
                        style={{ color: "var(--text)" }}
                      >
                        {portalLoading ? (
                          <Loader2Icon className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCardIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        )}
                        {portalLoading ? "Opening…" : "Billing"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Billing error toast */}
      {portalError && (
        <div
          className="fixed top-20 right-4 z-[120] flex items-start gap-3 rounded-xl px-4 py-3 max-w-sm shadow-xl"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid rgba(239,68,68,0.4)",
          }}
        >
          <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
          <p className="text-xs flex-1" style={{ color: "var(--text)" }}>{portalError}</p>
          <button
            onClick={() => setPortalError(null)}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}