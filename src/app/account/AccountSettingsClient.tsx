"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import {
  UserIcon, BellIcon, CreditCardIcon, AlertTriangleIcon,
  ZapIcon, ShieldAlertIcon, CheckIcon, ExternalLinkIcon,
} from "lucide-react"
import type { User } from "@/lib/db/schema"
import { PLANS } from "@/lib/plans"

interface Props {
  user: User
}

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free:    { label: "Free",    color: "var(--text-muted)", bg: "rgba(255,255,255,0.06)" },
  starter: { label: "Starter", color: "#60a5fa",          bg: "rgba(59,130,246,0.12)"  },
  pro:     { label: "Pro",     color: "var(--accent)",    bg: "rgba(245,166,35,0.12)"  },
}

export function AccountSettingsClient({ user }: Props) {
  const router = useRouter()
  const { signOut } = useClerk()

  // ── Notification prefs state ────────────────────────────
  const [digestEnabled,   setDigestEnabled]   = useState(user.emailDigestEnabled)
  // [P13-1] decayWarningsEnabled is now properly typed on the User type via schema.ts
  const [warningsEnabled, setWarningsEnabled] = useState(user.decayWarningsEnabled ?? true)
  const [prefSaving, setPrefSaving]     = useState(false)
  const [prefSaved,  setPrefSaved]      = useState(false)
  const [prefError,  setPrefError]      = useState<string | null>(null)

  // ── Billing portal ──────────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError,   setPortalError]   = useState<string | null>(null)

  // ── Delete account ──────────────────────────────────────
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleteOpen,        setDeleteOpen]        = useState(false)
  const [deleteError,       setDeleteError]       = useState<string | null>(null)
  const [isPending,         startTransition]      = useTransition()

  const planBadge = PLAN_LABELS[user.plan] ?? PLAN_LABELS.free
  const nextPlan  = user.plan === "free" ? "starter" : user.plan === "starter" ? "pro" : null

  // ── Handlers ───────────────────────────────────────────

  async function savePrefs(digest: boolean, warnings: boolean) {
    setPrefSaving(true)
    setPrefSaved(false)
    setPrefError(null)
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailDigestEnabled: digest, decayWarningsEnabled: warnings }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      setPrefSaved(true)
      setTimeout(() => setPrefSaved(false), 2500)
    } catch (err) {
      setPrefError(err instanceof Error ? err.message : "Failed to save preferences")
    } finally {
      setPrefSaving(false)
    }
  }

  function handleDigestToggle(val: boolean) {
    setDigestEnabled(val)
    savePrefs(val, warningsEnabled)
  }

  function handleWarningsToggle(val: boolean) {
    setWarningsEnabled(val)
    savePrefs(digestEnabled, val)
  }

  async function openBillingPortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error ?? "Could not open billing portal")
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Failed to open billing portal")
    } finally {
      setPortalLoading(false)
    }
  }

  function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return
    startTransition(async () => {
      setDeleteError(null)
      try {
        const res = await fetch("/api/account", { method: "DELETE" })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error ?? "Failed to delete account")
        }
        await signOut()
        router.push("/")
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Failed to delete account")
      }
    })
  }

  // ── Shared toggle component ─────────────────────────────
  function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
        style={{
          background:  checked ? "var(--accent)" : "var(--bg-hover)",
          border:      "1px solid var(--border)",
          cursor:      disabled ? "not-allowed" : "pointer",
          opacity:     disabled ? 0.5 : 1,
          flexShrink:  0,
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
    )
  }

  // ── Card wrapper ────────────────────────────────────────
  function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <div
        className="rounded-2xl p-6 mb-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5 mb-5">
          <span style={{ color: "var(--text-dim)" }}>{icon}</span>
          <h2 className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>{title}</h2>
        </div>
        {children}
      </div>
    )
  }

  function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
      <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <p className="text-sm" style={{ color: "var(--text)" }}>{label}</p>
          {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{hint}</p>}
        </div>
        <div className="shrink-0 flex items-center">{children}</div>
      </div>
    )
  }

  const email = user.email ?? ""

  return (
    <div>
      {/* Profile */}
      <Card title="Profile" icon={<UserIcon className="w-4 h-4" />}>
        <Row label="Email" hint="Managed by your sign-in provider">
          <span className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>{email}</span>
        </Row>
        <Row label="Plan">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: planBadge.bg, color: planBadge.color, fontFamily: "DM Mono, monospace" }}
            >
              {user.plan}
            </span>
            {nextPlan && (
              <a
                href="/pricing"
                className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ background: "var(--accent)", color: "#000", fontWeight: 600 }}
              >
                <ZapIcon className="w-3 h-3" /> Upgrade
              </a>
            )}
          </div>
        </Row>
        <div className="pt-3">
          <a
            href="https://accounts.clerk.dev/user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            <ExternalLinkIcon className="w-3 h-3" />
            Edit profile on Clerk →
          </a>
        </div>
      </Card>

      {/* Notifications */}
      <Card title="Notifications" icon={<BellIcon className="w-4 h-4" />}>
        {/* Weekly digest — Starter + Pro only */}
        {user.plan !== "free" ? (
          <Row
            label="Weekly decay digest"
            hint="Email summary of files approaching deletion, sent every Monday."
          >
            <Toggle checked={digestEnabled} onChange={handleDigestToggle} disabled={prefSaving} />
          </Row>
        ) : (
          <Row label="Weekly decay digest" hint="Available on Starter and Pro plans.">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-dim)" }}>
              Starter+
            </span>
          </Row>
        )}

        {/* Decay warnings — all tiers */}
        <Row
          label="Decay warning emails"
          hint={
            warningsEnabled
              ? "You'll receive warnings at 50%, 90%, and just before deletion."
              : "⚠️ Disabling warnings means you may lose files without notice."
          }
        >
          <Toggle checked={warningsEnabled} onChange={handleWarningsToggle} disabled={prefSaving} />
        </Row>

        {/* Feedback row */}
        <div className="pt-3 h-5">
          {prefSaving && (
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>Saving…</p>
          )}
          {prefSaved && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#34d399" }}>
              <CheckIcon className="w-3 h-3" /> Saved
            </p>
          )}
          {prefError && (
            <p className="text-xs" style={{ color: "#ef4444" }}>{prefError}</p>
          )}
        </div>
      </Card>

      {/* Billing */}
      <Card title="Billing" icon={<CreditCardIcon className="w-4 h-4" />}>
        <Row label="Current plan">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
            style={{ background: planBadge.bg, color: planBadge.color, fontFamily: "DM Mono, monospace" }}
          >
            {PLANS[user.plan].name} — {user.plan === "free" ? "Free" : `$${PLANS[user.plan].price}/mo`}
          </span>
        </Row>
        {portalError && (
          <p className="text-xs mb-3" style={{ color: "#ef4444" }}>{portalError}</p>
        )}
        <div className="pt-3 flex flex-wrap gap-2">
          {user.plan === "free" ? (
            <a
              href="/pricing"
              className="text-sm px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-85"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              <ZapIcon className="w-3.5 h-3.5" /> Upgrade plan
            </a>
          ) : (
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ border: "1px solid var(--border)", color: "var(--text)", background: "var(--bg-elevated)" }}
            >
              {portalLoading ? "Opening…" : "Manage billing →"}
            </button>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <div className="flex items-center gap-2.5 mb-5">
          <ShieldAlertIcon className="w-4 h-4" style={{ color: "#ef4444" }} />
          <h2 className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif", color: "#ef4444" }}>Danger zone</h2>
        </div>

        {!deleteOpen ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm">Delete my account</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                Permanently deletes your account, all files, and all data. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-red-500/20"
              style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)" }}
            >
              Delete account
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                This will permanently delete your account and <strong>all your files</strong> from our servers. This action is irreversible. Type <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: "var(--bg-hover)", color: "#ef4444" }}>DELETE</code> to confirm.
              </p>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full text-sm px-3 py-2 rounded-xl mb-3 outline-none"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "var(--text)",
              }}
            />
            {deleteError && (
              <p className="text-xs mb-3" style={{ color: "#ef4444" }}>{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || isPending}
                className="text-sm px-4 py-2 rounded-xl font-semibold transition-all disabled:opacity-40"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {isPending ? "Deleting…" : "Delete my account"}
              </button>
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirmText(""); setDeleteError(null) }}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ color: "var(--text-muted)", background: "var(--bg-hover)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}