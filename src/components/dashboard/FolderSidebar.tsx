"use client"

import { useState } from "react"
import {
  FolderIcon, FolderPlusIcon, HomeIcon,
  PencilIcon, Trash2Icon, XIcon, CheckIcon,
  AlertTriangleIcon, MenuIcon,
} from "lucide-react"
import type { Folder } from "@/lib/db/schema"

interface Props {
  folders: Folder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
  onRefresh: () => void
}

export function FolderSidebar({ folders, currentFolderId, onNavigate, onRefresh }: Props) {
  const [creating, setCreating]         = useState(false)
  const [newName, setNewName]           = useState("")
  const [saving, setSaving]             = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameValue, setRenameValue]   = useState("")
  const [renameError, setRenameError]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [mobileOpen, setMobileOpen]     = useState(false)

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
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
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
          const fileCount = folders.filter((f) => f.parentId === folder.id).length
          const isConfirming = confirmDelete?.id === folder.id
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
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded-md font-semibold"
                      style={{ background: "#ef4444", color: "#fff" }}>
                      <CheckIcon className="w-3 h-3" /> Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="flex-1 text-xs py-1 rounded-md" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
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
                    className="flex-1 text-sm rounded px-2 py-0.5 outline-none min-w-0"
                    style={{ background: "var(--bg-hover)", border: `1px solid ${renameError ? "#ef4444" : "var(--accent)"}`, color: "var(--text)" }} />
                  {renameError && <p className="text-xs" style={{ color: "#ef4444" }}>{renameError}</p>}
                </div>
              ) : (
                <button onClick={() => { onNavigate(folder.id); setMobileOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                  style={{
                    background: currentFolderId === folder.id ? "var(--accent-dim)" : "transparent",
                    color: currentFolderId === folder.id ? "var(--accent)" : "var(--text-muted)",
                  }}>
                  <FolderIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{folder.name}</span>
                  {fileCount > 0 && (
                    <span className="text-xs shrink-0" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>{fileCount}</span>
                  )}
                </button>
              )}

              {/* Hover actions — only shown when not in a special state */}
              {!isConfirming && renamingId !== folder.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); setRenameError(null) }}
                    className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--text-dim)" }} title="Rename">
                    <PencilIcon className="w-3 h-3" />
                  </button>
                  <button onClick={() => setConfirmDelete({ id: folder.id, name: folder.name })}
                    className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--text-dim)" }} title="Delete folder">
                    <Trash2Icon className="w-3 h-3" />
                  </button>
                </div>
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
              className="w-full text-sm rounded-lg px-3 py-1.5 outline-none mb-1.5"
              style={{ background: "var(--bg-hover)", border: `1px solid ${createError ? "#ef4444" : "var(--accent)"}`, color: "var(--text)" }} />
            {createError && <p className="text-xs mb-1.5" style={{ color: "#ef4444" }}>{createError}</p>}
            <div className="flex gap-1.5">
              <button onClick={createFolder} disabled={saving || !newName.trim()}
                className="flex-1 text-xs py-1 rounded-lg font-medium disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#000" }}>
                {saving ? "…" : "Create"}
              </button>
              <button onClick={() => { setCreating(false); setNewName(""); setCreateError(null) }}
                className="flex-1 text-xs py-1 rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
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

      {/* Mobile: floating toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
        aria-label="Open folders">
        <MenuIcon className="w-4 h-4" />
        Folders
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div
            className="fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden"
            style={{ width: "260px", background: "var(--bg)", borderRight: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-sm font-semibold">Folders</p>
              <button onClick={() => setMobileOpen(false)} className="action-btn p-1.5 rounded-lg">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {sidebarContent}
            </div>
          </div>
        </>
      )}
    </>
  )
}