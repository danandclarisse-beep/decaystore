// ROUTE: /admin/waitlist
// FILE:  src/app/admin/waitlist/page.tsx
//
// FIXES APPLIED:
//   [Issue 10 — LOW] Admin secret is no longer persisted in sessionStorage.
//     Previously: sessionStorage.setItem("ds_admin_secret", inputSecret)
//     sessionStorage is readable by any JavaScript on the same origin, including
//     browser extensions with broad permissions and any XSS vector. An attacker
//     with XSS access could exfiltrate the admin secret trivially.
//
//     Fix: the secret is now held only in React state (in-memory) for the
//     duration of the browser session. It is never written to sessionStorage,
//     localStorage, or any persistent client-side store.
//
//     Trade-off: the admin must re-enter the secret on each page load / refresh.
//     For an internal admin panel accessed infrequently, this is the right
//     security/UX balance. A proper solution would be a server-side HttpOnly
//     session cookie, but that requires a server-side session endpoint which is
//     outside the scope of this fix pass.

"use client"

import { useState, useEffect, useCallback } from "react"

type WaitlistEntry = {
  id: string
  email: string
  status: "pending" | "approved" | "token_expired" | "signed_up"
  joinedAt: string
  approvedAt: string | null
  signedUpAt: string | null
  tokenExpiresAt: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:       "bg-yellow-100 text-yellow-800",
  approved:      "bg-blue-100 text-blue-800",
  token_expired: "bg-red-100 text-red-700",
  signed_up:     "bg-green-100 text-green-800",
}

function fmt(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function AdminWaitlistPage() {
  // [FIX Issue 10] Secret is held in React state only — never written to
  // sessionStorage, localStorage, or any persistent client-side store.
  // This eliminates the XSS exfiltration vector while keeping the UX simple.
  const [secret, setSecret]           = useState("")
  const [inputSecret, setInputSecret] = useState("")
  const [entries, setEntries]         = useState<WaitlistEntry[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [batchSize, setBatchSize]     = useState(5)
  const [approving, setApproving]     = useState(false)
  const [approveResult, setApproveResult] = useState<string | null>(null)
  const [filter, setFilter]           = useState<"all" | "pending" | "approved" | "token_expired" | "signed_up">("all")

  // [FIX Issue 10] Removed the useEffect that restored from sessionStorage.
  // The admin will need to re-enter the secret on each page load. This is
  // intentional — see file header for rationale.

  const fetchEntries = useCallback(async (s: string) => {
    if (!s) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/waitlist", {
        headers: { Authorization: `Bearer ${s}` },
      })
      if (res.status === 401) { setError("Wrong secret."); setLoading(false); return }
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setEntries(data.entries)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when secret is set
  useEffect(() => {
    if (secret) fetchEntries(secret)
  }, [secret, fetchEntries])

  function login() {
    // [FIX Issue 10] Only update React state — no sessionStorage write.
    setSecret(inputSecret)
  }

  function logout() {
    // [FIX Issue 10] Clear React state only — nothing to remove from sessionStorage.
    setSecret("")
    setEntries([])
  }

  async function approve() {
    setApproving(true)
    setApproveResult(null)
    try {
      const res = await fetch("/api/admin/waitlist/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ count: batchSize }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setApproveResult(`✓ Approved ${data.approved} — invite emails sent.`)
      fetchEntries(secret)
    } catch (e: unknown) {
      setApproveResult(`✗ ${e instanceof Error ? e.message : "Approval failed"}`)
    } finally {
      setApproving(false)
    }
  }

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const visible = filter === "all" ? entries : entries.filter(e => e.status === filter)

  // ── Not authenticated ────────────────────────────────────────────────────────
  if (!secret) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
            Admin — Waitlist
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Enter your <code>ADMIN_SECRET</code> to continue.
          </p>
          <input
            type="password"
            placeholder="Admin secret"
            value={inputSecret}
            onChange={e => setInputSecret(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full px-4 py-2.5 rounded-lg border text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-card)",
              color: "var(--text)",
            }}
          />
          <button
            onClick={login}
            disabled={!inputSecret}
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            Unlock
          </button>
        </div>
      </main>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto"
      style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
            Waitlist Admin
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {entries.length} total · {counts.pending ?? 0} pending · {counts.signed_up ?? 0} signed up
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => fetchEntries(secret)}
            disabled={loading}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          {/* [FIX Issue 10] logout() clears React state only */}
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Approve panel */}
      <div
        className="mb-8 p-5 rounded-2xl border flex flex-wrap items-center gap-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-sm">Approve next batch</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Picks the oldest pending entries, sets status → approved, and emails invite links (48-hour expiry).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: "var(--text-muted)" }}>Count:</label>
          <input
            type="number"
            min={1}
            max={100}
            value={batchSize}
            onChange={e => setBatchSize(Number(e.target.value))}
            className="w-16 px-2 py-1.5 rounded-lg border text-sm text-center"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          <button
            onClick={approve}
            disabled={approving || (counts.pending ?? 0) === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        </div>
        {approveResult && (
          <p className="w-full text-sm mt-1" style={{
            color: approveResult.startsWith("✓") ? "var(--accent)" : "#dc2626"
          }}>
            {approveResult}
          </p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {(["all", "pending", "approved", "token_expired", "signed_up"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filter === f ? "var(--accent)" : "var(--bg-card)",
              color: filter === f ? "#000" : "var(--text-muted)",
              border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {f === "all" ? `All (${entries.length})` : `${f.replace("_", " ")} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                {["Email", "Status", "Joined", "Approved", "Token expires", "Signed up"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs"
                    style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}>
                    No entries.
                  </td>
                </tr>
              )}
              {visible.map((entry, i) => (
                <tr
                  key={entry.id}
                  style={{
                    background: i % 2 === 0 ? "var(--bg)" : "var(--bg-card)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td className="px-4 py-3 font-mono text-xs">{entry.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status] ?? ""}`}>
                      {entry.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(entry.joinedAt)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(entry.approvedAt)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(entry.tokenExpiresAt)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{fmt(entry.signedUpAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}