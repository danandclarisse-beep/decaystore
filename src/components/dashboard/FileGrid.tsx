"use client"

import { useState, useRef, useEffect } from "react"
import {
  RefreshCwIcon, Trash2Icon, DownloadIcon, ClockIcon,
  FolderIcon, PencilIcon, FolderInputIcon, GitBranchIcon,
  UploadIcon, XIcon, ChevronDownIcon, EyeIcon, MoreHorizontalIcon,
  AlertTriangleIcon, CheckIcon,
} from "lucide-react"
import { formatBytes, formatRelativeTime, getMimeTypeIcon } from "@/lib/utils"
import { getDecayColor, getDecayLabel, getDaysUntilDeletion } from "@/lib/decay-utils"
import type { File, Folder, FileVersion } from "@/lib/db/schema"

interface Props {
  files: File[]
  folders: Folder[]
  allFolders: Folder[]
  currentFolderId: string | null
  onRefresh: () => void
  onOpenFolder: (folder: Folder) => void
}

type ActionKey = string

export function FileGrid({ files, folders, allFolders, currentFolderId, onRefresh, onOpenFolder }: Props) {
  const [localFiles, setLocalFiles]           = useState<File[]>(files)
  useEffect(() => { setLocalFiles(files) }, [files])

  const [loadingKeys, setLoadingKeys]         = useState<Set<ActionKey>>(new Set())
  const [renamingId, setRenamingId]           = useState<string | null>(null)
  const [renameValue, setRenameValue]         = useState("")
  const [renameError, setRenameError]         = useState<string | null>(null)
  const [movingFile, setMovingFile]           = useState<File | null>(null)
  const [versionsFile, setVersionsFile]       = useState<File | null>(null)
  const [versions, setVersions]               = useState<FileVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [versionProgress, setVersionProgress] = useState(0)
  const [previewFile, setPreviewFile]         = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null)
  const [previewLoading, setPreviewLoading]   = useState(false)
  const [openMenuId, setOpenMenuId]           = useState<string | null>(null)
  const [confirmState, setConfirmState]       = useState<{ id: string; action: "delete" | "deleteVersion"; versionId?: string } | null>(null)
  const [renewedId, setRenewedId] = useState<string | null>(null)
  const renameFreshRef = useRef(false)

  function startLoading(key: ActionKey) { setLoadingKeys((p) => new Set(p).add(key)) }
  function stopLoading(key: ActionKey)  { setLoadingKeys((p) => { const s = new Set(p); s.delete(key); return s }) }
  function isLoading(key: ActionKey)    { return loadingKeys.has(key) }

  async function handleRename(fileId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    setRenamingId(null); setRenameError(null)
    setLocalFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, originalFilename: trimmed } : f))
    const res = await fetch(`/api/files/${fileId}/rename`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    const data = await res.json()
    if (!res.ok) {
      onRefresh(); setRenameError(data.error ?? "Rename failed")
      setRenamingId(fileId); setRenameValue(trimmed)
    } else { onRefresh() }
  }

  function startRename(file: File) {
    renameFreshRef.current = true
    setRenameError(null); setRenamingId(file.id); setRenameValue(file.originalFilename)
  }

  async function handleMove(fileId: string, folderId: string | null) {
    const key = fileId + "-move"; startLoading(key)
    try {
      await fetch(`/api/files/${fileId}/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
      setMovingFile(null); onRefresh()
    } finally { stopLoading(key) }
  }

  async function handleDownload(fileId: string, filename: string) {
    const key = fileId + "-download"; startLoading(key)
    try {
      const res  = await fetch(`/api/files/${fileId}`)
      const data = await res.json()
      if (data.downloadUrl) {
        const blob = await fetch(data.downloadUrl).then((r) => r.blob())
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href = url; a.download = filename; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        // Server resets lastAccessedAt on GET — mirror that in local state
        const accessedAt = new Date()
        setLocalFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, decayScore: 0, lastAccessedAt: accessedAt, status: "active" as const, warnedAt: null }
              : f
          )
        )
        setRenewedId(fileId)
        setTimeout(() => setRenewedId((id) => (id === fileId ? null : id)), 3000)
        onRefresh()
      }
    } finally { stopLoading(key) }
  }

  async function handlePreview(file: File) {
    setPreviewFile(file); setPreviewUrl(null); setPreviewLoading(true)
    try {
      const res  = await fetch(`/api/files/${file.id}`)
      const data = await res.json()
      if (data.downloadUrl) setPreviewUrl(data.downloadUrl)
    } finally { setPreviewLoading(false) }
  }

  async function handleRenew(fileId: string) {
    const key = fileId + "-renew"; startLoading(key)
    // Optimistic update: reset decay bar immediately so it feels instant
    const renewedAt = new Date()
    setLocalFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, decayScore: 0, lastAccessedAt: renewedAt, status: "active" as const, warnedAt: null }
          : f
      )
    )
    try {
      await fetch(`/api/files/${fileId}`, { method: "PATCH" })
      setRenewedId(fileId)
      setTimeout(() => setRenewedId((id) => (id === fileId ? null : id)), 3000)
      onRefresh()
    } catch {
      onRefresh() // revert to real server state on error
    } finally {
      stopLoading(key)
    }
  }

  async function handleDelete(fileId: string) {
    const key = fileId + "-delete"; startLoading(key); setConfirmState(null)
    try { await fetch(`/api/files/${fileId}`, { method: "DELETE" }); onRefresh() }
    finally { stopLoading(key) }
  }

  async function openVersions(file: File) {
    setVersionsFile(file); setVersionsLoading(true)
    try {
      const res  = await fetch(`/api/files/${file.id}/versions`)
      const data = await res.json()
      setVersions(data.versions ?? [])
    } finally { setVersionsLoading(false) }
  }

  async function downloadVersion(fileId: string, versionId: string, filename: string) {
    const res  = await fetch(`/api/files/${fileId}/versions/${versionId}`)
    const data = await res.json()
    if (data.downloadUrl) {
      const a = document.createElement("a"); a.href = data.downloadUrl; a.download = filename; a.click()
    }
  }

  async function handleDeleteVersion(fileId: string, versionId: string) {
    setConfirmState(null)
    await fetch(`/api/files/${fileId}/versions/${versionId}`, { method: "DELETE" })
    if (versionsFile) openVersions(versionsFile)
    onRefresh()
  }

  async function handleNewVersionUpload(file: File, selectedFile: globalThis.File) {
    setUploadingVersion(true); setVersionProgress(0)
    try {
      const metaRes = await fetch(`/api/files/${file.id}/versions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type || "application/octet-stream", sizeBytes: selectedFile.size }),
      })
      if (!metaRes.ok) throw new Error((await metaRes.json()).error)
      const { uploadUrl } = await metaRes.json()
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setVersionProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", selectedFile.type || "application/octet-stream")
        xhr.send(selectedFile)
      })
      if (versionsFile?.id === file.id) openVersions(file)
      onRefresh()
    } finally { setUploadingVersion(false); setVersionProgress(0) }
  }

  const sorted = [...localFiles].sort((a, b) => b.decayScore - a.decayScore)

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="rounded-xl py-20 text-center" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <FolderIcon className="w-6 h-6" style={{ color: "var(--text-dim)" }} />
        </div>
        <p className="text-sm font-medium mb-1">{currentFolderId ? "This folder is empty" : "No files yet"}</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {currentFolderId ? "Upload files here or move existing files into this folder." : "Drop a file above or create a folder in the sidebar."}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {folders.length > 0 && `${folders.length} folder${folders.length !== 1 ? "s" : ""}  · `}
          {files.length} file{files.length !== 1 ? "s" : ""}
        </p>
        <button onClick={onRefresh} className="action-btn text-xs flex items-center gap-1.5 px-3 py-1.5"
          style={{ border: "1px solid var(--border)", borderRadius: "8px" }}>
          <RefreshCwIcon className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <button key={folder.id} onClick={() => onOpenFolder(folder)}
            className="rounded-xl p-5 text-left transition-all group"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <FolderIcon className="w-8 h-8 shrink-0" style={{ color: "var(--accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{folder.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Folder · {formatRelativeTime(folder.createdAt)}</p>
              </div>
              <ChevronDownIcon className="w-4 h-4 -rotate-90 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-dim)" }} />
            </div>
          </button>
        ))}

        {sorted.map((file) => {
          const decayColor   = getDecayColor(file.decayScore)
          const decayLabel   = getDecayLabel(file.decayScore)
          const daysLeft     = getDaysUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)
          const isCritical   = file.decayScore >= 0.75
          const isExpiring   = file.decayScore >= 0.9
          const isRenaming   = renamingId === file.id
          const isDeleting   = isLoading(file.id + "-delete")
          const isDownloading = isLoading(file.id + "-download")
          const isRenewing   = isLoading(file.id + "-renew")
          const isConfirmingDelete = confirmState?.id === file.id && confirmState.action === "delete"
          const isRenewed   = renewedId === file.id

          return (
            <div key={file.id} className="rounded-xl p-5 flex flex-col gap-3 transition-all"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${isExpiring ? "rgba(239,68,68,0.3)" : isCritical ? "rgba(249,115,22,0.2)" : "var(--border)"}`,
                boxShadow: isExpiring ? "0 0 20px rgba(239,68,68,0.05)" : "none",
                opacity: isDeleting ? 0.5 : 1, transition: "opacity 0.2s",
              }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{getMimeTypeIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div>
                      <input autoFocus value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(file.id); if (e.key === "Escape") { setRenamingId(null); setRenameError(null) } }}
                        onFocus={() => { renameFreshRef.current = false }}
                        onBlur={() => { if (renameFreshRef.current) { renameFreshRef.current = false; return } handleRename(file.id) }}
                        className="w-full text-sm rounded px-2 py-0.5 outline-none"
                        style={{ background: "var(--bg-hover)", border: `1px solid ${renameError ? "#ef4444" : "var(--accent)"}`, color: "var(--text)" }} />
                      {renameError && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{renameError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/name">
                      <p className="text-sm font-medium truncate cursor-pointer"
                        title="Click pencil or double-click to rename" onDoubleClick={() => startRename(file)}>
                        {file.originalFilename}
                      </p>
                      <button onClick={() => startRename(file)}
                        className="shrink-0 p-0.5 rounded opacity-0 group-hover/name:opacity-100 transition-opacity"
                        style={{ color: "var(--text-dim)" }} title="Rename">
                        <PencilIcon className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    {formatBytes(file.sizeBytes)} · v{file.currentVersionNumber} · {formatRelativeTime(file.uploadedAt)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  {isRenewed ? (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#34d399" }}>
                      <CheckIcon className="w-3 h-3" /> Renewed!
                    </span>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: decayColor, fontFamily: "DM Mono, monospace" }}>{decayLabel}</span>
                  )}
                  <span className="text-xs flex items-center gap-1 cursor-help" title="Decay timer resets automatically when you download or preview a file. Use Renew to reset it manually at any time." style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    <ClockIcon className="w-3 h-3" />
                    {(isRenewed || file.decayScore === 0) ? `${file.decayRateDays}d left` : `${daysLeft}d left`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div className={`h-full rounded-full transition-all duration-700${isCritical && !isRenewed ? " animate-pulse-slow" : ""}`}
                    style={{ width: isRenewed ? "0%" : `${file.decayScore * 100}%`, background: isRenewed ? "#34d399" : decayColor }} />
                </div>

              </div>

              {isConfirmingDelete ? (
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertTriangleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                  <p className="text-xs flex-1" style={{ color: "#ef4444" }}>Permanently delete? This cannot be undone.</p>
                  <button onClick={() => handleDelete(file.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0"
                    style={{ background: "#ef4444", color: "#fff" }}>
                    <CheckIcon className="w-3 h-3" /> Delete
                  </button>
                  <button onClick={() => setConfirmState(null)} className="action-btn p-1 rounded-lg shrink-0">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <button onClick={() => handlePreview(file)}
                    className="action-btn flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg">
                    <EyeIcon className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button onClick={() => handleDownload(file.id, file.originalFilename)} disabled={isDownloading}
                    className="action-btn flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg disabled:opacity-60">
                    {isDownloading ? (
                      <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                        style={{ borderColor: "var(--border)", borderTopColor: "var(--text-muted)" }} />Fetching…</>
                    ) : <><DownloadIcon className="w-3.5 h-3.5" /> Download</>}
                  </button>
                  <button onClick={() => handleRenew(file.id)} disabled={isRenewing || isRenewed}
                    className="action-btn-green flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg disabled:opacity-60"
                    title="Manually reset decay timer to full duration">
                    {isRenewing ? (
                      <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                        style={{ borderColor: "rgba(52,211,153,0.3)", borderTopColor: "#34d399" }} />Renewing…</>
                    ) : isRenewed ? (
                      <><CheckIcon className="w-3.5 h-3.5" /> Renewed!</>
                    ) : <><RefreshCwIcon className="w-3.5 h-3.5" /> Renew</>}
                  </button>
                  <div className="relative shrink-0">
                    <button onClick={() => setOpenMenuId(openMenuId === file.id ? null : file.id)}
                      className="action-btn p-1.5 rounded-lg" title="More actions">
                      <MoreHorizontalIcon className="w-4 h-4" />
                    </button>
                    {openMenuId === file.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 bottom-full mb-1.5 z-20 rounded-xl overflow-hidden py-1 min-w-[160px]"
                          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                          <button onClick={() => { startRename(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors">
                            <PencilIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Rename
                          </button>
                          <button onClick={() => { setMovingFile(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors">
                            <FolderInputIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Move to folder
                          </button>
                          <button onClick={() => { openVersions(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors">
                            <GitBranchIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Versions (v{file.currentVersionNumber})
                          </button>
                          <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />
                          <button onClick={() => { setConfirmState({ id: file.id, action: "delete" }); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ color: "#ef4444" }}>
                            <Trash2Icon className="w-3.5 h-3.5 shrink-0" /> Delete permanently
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {movingFile && (
        <Modal title="Move to folder" onClose={() => setMovingFile(null)}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Moving: <strong style={{ color: "var(--text)" }}>{movingFile.originalFilename}</strong>
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            <button onClick={() => handleMove(movingFile.id, null)} disabled={isLoading(movingFile.id + "-move")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
              style={{ background: movingFile.folderId === null ? "var(--accent-dim)" : "var(--bg-hover)", color: movingFile.folderId === null ? "var(--accent)" : "var(--text-muted)" }}>
              <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} /> Root (My Files)
            </button>
            {allFolders.map((folder) => (
              <button key={folder.id} onClick={() => handleMove(movingFile.id, folder.id)}
                disabled={movingFile.folderId === folder.id || isLoading(movingFile.id + "-move")}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
                style={{ background: movingFile.folderId === folder.id ? "var(--accent-dim)" : "var(--bg-hover)", color: movingFile.folderId === folder.id ? "var(--accent)" : "var(--text-muted)" }}>
                <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /> {folder.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {versionsFile && (
        <Modal title={`Version history — ${versionsFile.originalFilename}`}
          onClose={() => { setVersionsFile(null); setVersions([]) }} wide>
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">Upload new version</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Current: v{versionsFile.currentVersionNumber}</p>
              </div>
              <label className="btn-accent text-xs px-4 py-2 rounded-lg cursor-pointer font-medium">
                {uploadingVersion ? "Uploading…" : <span className="flex items-center gap-1.5"><UploadIcon className="w-3.5 h-3.5" /> Upload v{versionsFile.currentVersionNumber + 1}</span>}
                <input type="file" className="hidden" disabled={uploadingVersion}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNewVersionUpload(versionsFile, f) }} />
              </label>
            </div>
            {uploadingVersion && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Uploading…</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>{versionProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${versionProgress}%`, background: "var(--accent)" }} />
                </div>
              </div>
            )}
          </div>

          {versionsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            ))}</div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No versions found</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => {
                const isCurrent = v.versionNumber === versionsFile.currentVersionNumber
                const isConfirmingVersionDelete = confirmState?.id === versionsFile.id && confirmState.action === "deleteVersion" && confirmState.versionId === v.id
                return (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: isCurrent ? "var(--accent-dim)" : "var(--bg-elevated)", border: `1px solid ${isCurrent ? "rgba(245,166,35,0.25)" : "var(--border)"}` }}>
                    <span className="text-xs font-bold w-8 shrink-0"
                      style={{ color: isCurrent ? "var(--accent)" : "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>v{v.versionNumber}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{v.label ?? `Version ${v.versionNumber}`}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {formatBytes(v.sizeBytes)} · {formatRelativeTime(v.uploadedAt)}
                      </p>
                    </div>
                    {isCurrent && <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>Current</span>}
                    {isConfirmingVersionDelete ? (
                      <>
                        <span className="text-xs shrink-0" style={{ color: "#ef4444" }}>Delete?</span>
                        <button onClick={() => handleDeleteVersion(versionsFile.id, v.id)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold shrink-0" style={{ background: "#ef4444", color: "#fff" }}>Yes</button>
                        <button onClick={() => setConfirmState(null)} className="action-btn p-1 rounded-md shrink-0"><XIcon className="w-3 h-3" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => downloadVersion(versionsFile.id, v.id, versionsFile.originalFilename)}
                          className="action-btn p-1.5 rounded-md shrink-0" title="Download this version">
                          <DownloadIcon className="w-3.5 h-3.5" />
                        </button>
                        {!isCurrent && (
                          <button onClick={() => setConfirmState({ id: versionsFile.id, action: "deleteVersion", versionId: v.id })}
                            className="action-btn-red p-1.5 rounded-md shrink-0" title="Delete this version">
                            <Trash2Icon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {previewFile && (
        <Modal title={previewFile.originalFilename} onClose={() => { setPreviewFile(null); setPreviewUrl(null) }} fullscreen>
          <div className="flex flex-col gap-3 overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
            <div className="flex items-center justify-between shrink-0">
              <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                {formatBytes(previewFile.sizeBytes)} · {previewFile.mimeType}
              </p>
              <button onClick={() => handleDownload(previewFile.id, previewFile.originalFilename)}
                disabled={isLoading(previewFile.id + "-download")}
                className="action-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md disabled:opacity-60">
                {isLoading(previewFile.id + "-download") ? (
                  <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--text-muted)" }} />Fetching…</>
                ) : <><DownloadIcon className="w-3.5 h-3.5" /> Download</>}
              </button>
            </div>
            <div className="rounded-xl overflow-auto flex items-center justify-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", flex: 1, minHeight: 0 }}>
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
                  <p className="text-xs">Loading preview…</p>
                </div>
              ) : !previewUrl ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Preview unavailable</p>
              ) : previewFile.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewFile.originalFilename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : previewFile.mimeType.startsWith("video/") ? (
                <video src={previewUrl} controls style={{ maxWidth: "100%", maxHeight: "100%" }} />
              ) : previewFile.mimeType.startsWith("audio/") ? (
                <audio src={previewUrl} controls className="w-full" style={{ margin: "auto" }} />
              ) : previewFile.mimeType === "application/pdf" ? (
                <iframe src={previewUrl} className="w-full h-full rounded-xl" style={{ minHeight: "70vh" }} />
              ) : previewFile.mimeType.startsWith("text/") ? (
                <TextPreview url={previewUrl} />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8" style={{ color: "var(--text-muted)" }}>
                  <span className="text-5xl">{getMimeTypeIcon(previewFile.mimeType)}</span>
                  <p className="text-sm text-center">No preview available for this file type.</p>
                  <button onClick={() => handleDownload(previewFile.id, previewFile.originalFilename)}
                    className="action-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md mt-1">
                    <DownloadIcon className="w-3.5 h-3.5" /> Download to open
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText("Could not load text."))
  }, [url])
  return (
    <pre className="w-full max-h-96 overflow-auto text-xs p-4 rounded-xl"
      style={{ background: "var(--bg-elevated)", color: "var(--text)", fontFamily: "DM Mono, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {text ?? "Loading…"}
    </pre>
  )
}

function Modal({ title, onClose, children, wide = false, fullscreen = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; fullscreen?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`rounded-2xl w-full flex flex-col ${fullscreen ? "max-w-6xl p-6" : wide ? "max-w-2xl p-6" : "max-w-sm p-6"}`}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: fullscreen ? "92vh" : "85vh", overflow: "hidden" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-base font-semibold truncate pr-4">{title}</h3>
          <button onClick={onClose} className="action-btn p-1.5 rounded-lg shrink-0"><XIcon className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col overflow-hidden" style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  )
}