"use client"

import { useState } from "react"
import {
  FolderIcon, FolderPlusIcon, HomeIcon,
  PencilIcon, Trash2Icon, XIcon, CheckIcon,
  AlertTriangleIcon, MenuIcon, MoreHorizontalIcon,
  Settings2Icon, ClockIcon,
} from "lucide-react"
import type { Folder } from "@/lib/db/schema"

// [P8-3] Allowed decay rate options — mirrors the server-side ALLOWED_DECAY_RATES set.
const DECAY_RATE_OPTIONS = [
  { label: "7 days",   value: 7   },
  { label: "14 days",  value: 14  },
  { label: "30 days",  value: 30  },
  { label: "60 days",  value: 60  },
  { label: "90 days",  value: 90  },
  { label: "180 days", value: 180 },
  { label: "1 year",   value: 365 },
]

interface Props {
  folders: Folder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
  onRefresh: () => void
  /** Pass user plan to conditionally show Pro-only decay settings */
  plan?: string
}

export function FolderSidebar({ folders, currentFolderId, onNavigate, onRefresh, plan }: Props) {
  const isPro = plan === "pro"

  const [creating, setCreating]           = useState(false)
  const [newName, setNewName]             = useState("")
  const [saving, setSaving]               = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)
  const [renamingId, setRenamingId]       = useState<string | null>(null)
  const [renameValue, setRenameValue]     = useState("")
  const [renameError, setRenameError]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [openActionId, setOpenActionId]   = useState<string | null>(null)

  // [P8-3] Folder decay rate settings modal
  const [decaySettingsFolder, setDecaySettingsFolder] = useState<Folder | null>(null)
  const [pendingDecayRate, setPendingDecayRate]        = useState<number | null>(null)
  const [savingDecay, setSavingDecay]                 = useState(false)
  const [decayError, setDecayError]                   = useState<string | null>(null)

  async function saveDecayRate() {
    if (!decaySettingsFolder) return
    setSavingDecay(true); setDecayError(null)
    try {
      const res = await fetch(`/api/folders/${decaySettingsFolder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDecayRateDays: pendingDecayRate }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDecayError(data.error ?? "Failed to save decay rate")
        return
      }
      setDecaySettingsFolder(null); setPendingDecayRate(null); onRefresh()
    } finally {
      setSavingDecay(false)
    }
  }

  const rootFolders = folders.filter((f) => f.parentId === null)

  async function createFolder() {
    if (!newName.trim()) return
    setSaving(true); setCreateError(null)
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentId: currentFolderId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.error ?? "Failed to create folder")
        return
      }
      setNewName(""); setCreating(false); onRefresh()
    } finally { setSaving(false) }
  }

  async function renameFolder(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    setRenameError(null)
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setRenameError(data.error ?? "Rename failed")
      return
    }
    setRenamingId(null); onRefresh()
  }

  async function handleDeleteFolder(id: string) {
    setConfirmDelete(null)
    await fetch(`/api/folders/${id}`, { method: "DELETE" })
    if (currentFolderId === id) onNavigate(null)
    onRefresh()
  }

  const sidebarContent = (
    <div className="rounded-xl p-3 sticky top-24"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

      {/* Root */}
      <button onClick={() => { onNavigate(null); setMobileOpen(false) }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
        style={{
          background: currentFolderId === null ? "var(--accent-dim)" : "transparent",
          color: currentFolderId === null ? "var(--accent)" : "var(--text-muted)",
        }}>
        <HomeIcon className="w-4 h-4 shrink-0" /> My Files
      </button>

      <div className="my-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

      {/* Folders */}
      <div className="space-y-0.5">
        {rootFolders.map((folder) => {
          const fileCount     = folders.filter((f) => f.parentId === folder.id).length
          const isConfirming  = confirmDelete?.id === folder.id
          const isActionsOpen = openActionId === folder.id
          return (
            <div key={folder.id} className="group relative">
              {isConfirming ? (
                <div className="rounded-lg px-2 py-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangleIcon className="w-3 h-3 shrink-0" style={{ color: "#ef4444" }} />
                    <p className="text-xs" style={{ color: "#ef4444" }}>Delete &ldquo;{folder.name}&rdquo;?</p>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>Files inside will move to root.</p>
                  <div className="flex gap-1">
                    <button onClick={() => handleDeleteFolder(folder.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md font-semibold"
                      style={{ background: "#ef4444", color: "#fff" }}>
                      <CheckIcon className="w-3 h-3" /> Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="flex-1 text-xs py-1.5 rounded-md" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : renamingId === folder.id ? (
                <div className="flex flex-col gap-1.5 px-2 py-1">
                  <input autoFocus value={renameValue}
                    onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                    onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id); if (e.key === "Escape") setRenamingId(null) }}
                    onBlur={() => renameFolder(folder.id)}
                    className="flex-1 text-sm rounded px-2 py-1 outline-none min-w-0"
                    style={{ background: "var(--bg-hover)", border: `1px solid ${renameError ? "#ef4444" : "var(--accent)"}`, color: "var(--text)" }} />
                  {renameError && <p className="text-xs" style={{ color: "#ef4444" }}>{renameError}</p>}
                </div>
              ) : (
                <>
                  <button onClick={() => { onNavigate(folder.id); setMobileOpen(false); setOpenActionId(null) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                    style={{
                      background: currentFolderId === folder.id ? "var(--accent-dim)" : "transparent",
                      color: currentFolderId === folder.id ? "var(--accent)" : "var(--text-muted)",
                      paddingRight: "2rem",
                    }}>
                    <FolderIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{folder.name}</span>
                    {fileCount > 0 && (
                      <span className="text-xs shrink-0" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>{fileCount}</span>
                    )}
                  </button>

                  {/* Actions button — always tappable on touch, hover-only on desktop */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenActionId(isActionsOpen ? null : folder.id) }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors lg:opacity-0 lg:group-hover:opacity-100"
                    style={{ color: "var(--text-dim)", background: isActionsOpen ? "var(--bg-hover)" : "transparent" }}
                    title="Folder options"
                  >
                    <MoreHorizontalIcon className="w-3.5 h-3.5" />
                  </button>

                  {/* Popover actions */}
                  {isActionsOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenActionId(null)} />
                      <div
                        className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1"
                        style={{
                          minWidth: 140,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        }}
                      >
                        {isPro && (
                          <button
                            onClick={() => {
                              setDecaySettingsFolder(folder)
                              setPendingDecayRate(folder.defaultDecayRateDays ?? null)
                              setDecayError(null)
                              setOpenActionId(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Settings2Icon className="w-3.5 h-3.5 shrink-0" /> Decay settings
                          </button>
                        )}
                        <button
                          onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); setRenameError(null); setOpenActionId(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <PencilIcon className="w-3.5 h-3.5 shrink-0" /> Rename
                        </button>
                        <button
                          onClick={() => { setConfirmDelete({ id: folder.id, name: folder.name }); setOpenActionId(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          style={{ color: "#ef4444" }}
                        >
                          <Trash2Icon className="w-3.5 h-3.5 shrink-0" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* New folder */}
      <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {creating ? (
          <div className="px-2">
            <input autoFocus placeholder="Folder name" value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(null) }}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setCreating(false); setNewName("") } }}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none mb-1.5"
              style={{ background: "var(--bg-hover)", border: `1px solid ${createError ? "#ef4444" : "var(--accent)"}`, color: "var(--text)" }} />
            {createError && <p className="text-xs mb-1.5" style={{ color: "#ef4444" }}>{createError}</p>}
            <div className="flex gap-1.5">
              <button onClick={createFolder} disabled={saving || !newName.trim()}
                className="flex-1 text-xs py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#000" }}>
                {saving ? "…" : "Create"}
              </button>
              <button onClick={() => { setCreating(false); setNewName(""); setCreateError(null) }}
                className="flex-1 text-xs py-1.5 rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-dim)" }}>
            <FolderPlusIcon className="w-4 h-4" /> New folder
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-52 shrink-0 hidden lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile: floating toggle — left side, clear of notification FAB on right */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-5 left-4 z-40 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium shadow-lg"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
        aria-label="Open folders">
        <MenuIcon className="w-4 h-4" />
        <span>Folders</span>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div
            className="fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden"
            style={{ width: "280px", background: "var(--bg)", borderRight: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>Folders</p>
              <button onClick={() => setMobileOpen(false)} className="action-btn p-2 rounded-lg">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {sidebarContent}
            </div>
          </div>
        </>
      )}
      {/* [P8-3] Folder decay settings modal (Pro only) */}
      {decaySettingsFolder && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => { setDecaySettingsFolder(null); setDecayError(null) }} />
          <div
            className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            style={{
              width: "min(420px, calc(100vw - 32px))",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-sm" style={{ fontFamily: "Syne, sans-serif" }}>
                  Decay settings
                </p>
                <p className="text-xs mt-0.5 truncate max-w-[240px]" style={{ color: "var(--text-dim)" }}>
                  {decaySettingsFolder.name}
                </p>
              </div>
              <button onClick={() => { setDecaySettingsFolder(null); setDecayError(null) }}
                className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-dim)" }}>
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Default decay rate for new uploads</p>
              </div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Files uploaded into this folder will inherit this decay rate. You can still override it per file at upload time.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                Default decay rate
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPendingDecayRate(null)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border"
                  style={{
                    background: pendingDecayRate === null ? "var(--accent-dim)" : "transparent",
                    borderColor: pendingDecayRate === null ? "var(--accent)" : "var(--border-subtle)",
                    color: pendingDecayRate === null ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  Plan default
                </button>
                {DECAY_RATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPendingDecayRate(opt.value)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border"
                    style={{
                      background: pendingDecayRate === opt.value ? "var(--accent-dim)" : "transparent",
                      borderColor: pendingDecayRate === opt.value ? "var(--accent)" : "var(--border-subtle)",
                      color: pendingDecayRate === opt.value ? "var(--accent)" : "var(--text-dim)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {decayError && (
              <p className="text-xs mb-3" style={{ color: "#ef4444" }}>{decayError}</p>
            )}

            <div className="flex gap-2">
              <button onClick={saveDecayRate} disabled={savingDecay}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                style={{ background: "var(--accent)", color: "#000" }}>
                {savingDecay ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setDecaySettingsFolder(null); setDecayError(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}