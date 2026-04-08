"use client"

import { useState, useEffect } from "react"
import {
  KeyIcon, PlusIcon, Trash2Icon, CopyIcon,
  CheckIcon, XIcon, AlertCircleIcon, EyeOffIcon,
} from "lucide-react"
import { formatDateTime, formatRelativeTime } from "@/lib/utils"
import { HelpTooltip } from "@/components/dashboard/HelpTooltip"

interface ApiKeyDisplay {
  id:         string
  label:      string
  keyPrefix:  string
  lastUsedAt: string | null
  createdAt:  string
}

interface Props {
  /** Only renders if the user is on the Pro plan */
  isPro: boolean
}

export function ApiKeysPanel({ isPro }: Props) {
  const [keys, setKeys]                 = useState<ApiKeyDisplay[]>([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [newLabel, setNewLabel]         = useState("")
  const [newKeyRaw, setNewKeyRaw]       = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [confirmId, setConfirmId]       = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (!isPro) return
    fetchKeys()
  }, [isPro])

  async function fetchKeys() {
    setLoading(true)
    try {
      const res  = await fetch("/api/keys")
      const data = await res.json()
      setKeys(data.keys ?? [])
    } catch {
      setError("Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const label = newLabel.trim()
    if (!label) return
    setCreating(true)
    setError(null)
    try {
      const res  = await fetch("/api/keys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ label }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create key"); return }
      setNewKeyRaw(data.key.rawKey)
      setNewLabel("")
      setShowCreateForm(false)
      await fetchKeys()
    } catch {
      setError("Failed to create key")
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(keyId: string) {
    setDeletingId(keyId)
    setConfirmId(null)
    try {
      await fetch(`/api/keys?id=${keyId}`, { method: "DELETE" })
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch {
      setError("Failed to revoke key")
    } finally {
      setDeletingId(null)
    }
  }

  function copyKey(raw: string) {
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!isPro) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", overflowX: "hidden" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <KeyIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>
            API Keys
          </span>
          <HelpTooltip
            content="Generate keys to access your files programmatically. The raw key is shown exactly once — store it securely."
            guideAnchor="pro"
            position="bottom"
          />
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "DM Mono, monospace" }}
          >
            Pro
          </span>
        </div>
        <button
          onClick={() => { setShowCreateForm((o) => !o); setError(null) }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New key
        </button>
      </div>

      {/* New-key revealed banner */}
      {newKeyRaw && (
        <div
          className="mx-4 mt-4 rounded-xl p-4"
          style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.25)" }}
        >
          <div className="flex items-start gap-2 mb-2">
            <CheckIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#10b981" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#10b981" }}>
                API key created — copy it now
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                This key will <strong style={{ color: "var(--text)" }}>never be shown again</strong>. Store it securely.
              </p>
            </div>
            <button
              onClick={() => setNewKeyRaw(null)}
              className="ml-auto p-0.5 rounded action-btn shrink-0"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <EyeOffIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)" }} />
            <code
              className="flex-1 text-xs select-all truncate"
              style={{ fontFamily: "DM Mono, monospace", color: "var(--text)" }}
            >
              {newKeyRaw}
            </code>
            <button
              onClick={() => copyKey(newKeyRaw)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md shrink-0 font-semibold transition-colors"
              style={{
                background: copied ? "rgba(52,211,153,0.15)" : "var(--bg-hover)",
                color:      copied ? "#10b981" : "var(--text-muted)",
                border:     "1px solid var(--border)",
              }}
            >
              {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div
          className="mx-4 mt-4 rounded-xl p-4"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
            New API key label
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
              placeholder="e.g. My CI pipeline"
              className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
              style={{
                background: "var(--bg-card)",
                border:     "1px solid var(--accent)",
                color:      "var(--text)",
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newLabel.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewLabel("") }}
              className="action-btn p-2 rounded-lg"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "#ef4444" }} />
          <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto action-btn p-0.5 rounded shrink-0">
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Key list */}
      <div className="p-4 space-y-2">
        {loading ? (
          [...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: "var(--bg-elevated)", animationDelay: `${i * 80}ms` }}
            />
          ))
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <KeyIcon className="w-6 h-6" style={{ color: "var(--text-dim)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No API keys yet</p>
            <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-dim)" }}>
              Create a key to authenticate requests from scripts, CI pipelines, or external tools.
            </p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            >
              <KeyIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{key.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                  {key.keyPrefix}••••••••••••••••••••••••
                  {" · "}
                  {key.lastUsedAt
                    ? `Last used ${formatRelativeTime(key.lastUsedAt)}`
                    : "Never used"}
                </p>
              </div>
              <span className="text-xs shrink-0 hidden sm:block" style={{ color: "var(--text-dim)" }}>
                {formatDateTime(key.createdAt)}
              </span>

              {confirmId === key.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs" style={{ color: "#ef4444" }}>Revoke?</span>
                  <button
                    onClick={() => handleDelete(key.id)}
                    disabled={deletingId === key.id}
                    className="text-xs px-2 py-1 rounded-lg font-semibold disabled:opacity-50"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    Yes
                  </button>
                  <button onClick={() => setConfirmId(null)} className="action-btn p-1 rounded-md shrink-0">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(key.id)}
                  className="action-btn-red p-1.5 rounded-lg shrink-0"
                  title="Revoke key"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer — link to docs */}
      <div
        className="px-5 py-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Authenticate requests with{" "}
          <code style={{ fontFamily: "DM Mono, monospace", color: "var(--text-muted)" }}>
            Authorization: Bearer dsk_…
          </code>
          {" · "}
          <a
            href="/api-docs"
            className="underline underline-offset-2"
            style={{ color: "var(--accent)" }}
          >
            View API docs
          </a>
        </p>
      </div>
    </div>
  )
}