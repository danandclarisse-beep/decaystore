"use client"

import { useState } from "react"
import { FolderIcon, FolderPlusIcon, ChevronRightIcon, HomeIcon } from "lucide-react"
import type { Folder } from "@/lib/db/schema"

interface Props {
  folders: Folder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
  onRefresh: () => void
}

export function FolderSidebar({ folders, currentFolderId, onNavigate, onRefresh }: Props) {
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState("")
  const [saving, setSaving]       = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const rootFolders = folders.filter((f) => f.parentId === null)

  async function createFolder() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentId: currentFolderId }),
      })
      setNewName("")
      setCreating(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function renameFolder(id: string) {
    if (!renameValue.trim()) return
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    setRenamingId(null)
    onRefresh()
  }

  async function deleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"? Files inside will be moved to root.`)) return
    await fetch(`/api/folders/${id}`, { method: "DELETE" })
    if (currentFolderId === id) onNavigate(null)
    onRefresh()
  }

  return (
    <aside
      className="w-52 shrink-0 hidden lg:block"
    >
      <div
        className="rounded-xl p-3 sticky top-24"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Root */}
        <button
          onClick={() => onNavigate(null)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
          style={{
            background: currentFolderId === null ? "var(--accent-dim)" : "transparent",
            color: currentFolderId === null ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          <HomeIcon className="w-4 h-4 shrink-0" />
          My Files
        </button>

        {/* Divider */}
        <div className="my-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

        {/* Folders */}
        <div className="space-y-0.5">
          {rootFolders.map((folder) => (
            <div key={folder.id} className="group relative">
              {renamingId === folder.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameFolder(folder.id)
                      if (e.key === "Escape") setRenamingId(null)
                    }}
                    onBlur={() => renameFolder(folder.id)}
                    className="flex-1 text-sm rounded px-2 py-0.5 outline-none min-w-0"
                    style={{
                      background: "var(--bg-hover)",
                      border: "1px solid var(--accent)",
                      color: "var(--text)",
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => onNavigate(folder.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                  style={{
                    background: currentFolderId === folder.id ? "var(--accent-dim)" : "transparent",
                    color: currentFolderId === folder.id ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  <FolderIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{folder.name}</span>
                </button>
              )}

              {/* Hover actions */}
              <div
                className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5"
              >
                <button
                  onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                  className="p-1 rounded text-xs transition-colors"
                  style={{ color: "var(--text-dim)" }}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteFolder(folder.id, folder.name)}
                  className="p-1 rounded text-xs transition-colors"
                  style={{ color: "var(--text-dim)" }}
                  title="Delete folder"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New folder */}
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {creating ? (
            <div className="px-2">
              <input
                autoFocus
                placeholder="Folder name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFolder()
                  if (e.key === "Escape") { setCreating(false); setNewName("") }
                }}
                className="w-full text-sm rounded-lg px-3 py-1.5 outline-none mb-2"
                style={{
                  background: "var(--bg-hover)",
                  border: "1px solid var(--accent)",
                  color: "var(--text)",
                }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={createFolder}
                  disabled={saving || !newName.trim()}
                  className="flex-1 text-xs py-1 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                >
                  {saving ? "…" : "Create"}
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName("") }}
                  className="flex-1 text-xs py-1 rounded-lg"
                  style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              <FolderPlusIcon className="w-4 h-4" />
              New folder
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}