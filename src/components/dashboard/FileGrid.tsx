"use client"

import { useState, useRef } from "react"
import {
  RefreshCwIcon, Trash2Icon, DownloadIcon, ClockIcon,
  FolderIcon, PencilIcon, FolderInputIcon, GitBranchIcon,
  UploadIcon, XIcon, ChevronDownIcon, EyeIcon,
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

export function FileGrid({ files, folders, allFolders, currentFolderId, onRefresh, onOpenFolder }: Props) {
  const [actionLoading, setActionLoading]   = useState<string | null>(null)
  const [renamingId, setRenamingId]         = useState<string | null>(null)
  const [renameValue, setRenameValue]       = useState("")
  const [renameError, setRenameError]       = useState<string | null>(null)
  const [movingFile, setMovingFile]         = useState<File | null>(null)
  const [versionsFile, setVersionsFile]     = useState<File | null>(null)
  const [versions, setVersions]             = useState<FileVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [previewFile, setPreviewFile]       = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // Suppress onBlur firing rename immediately after double-click opens the input
  const renameFreshRef = useRef(false)

  // ── Rename ──────────────────────────────────────────────
  async function handleRename(fileId: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    setActionLoading(fileId + "-rename")
    setRenameError(null)
    try {
      const res = await fetch(`/api/files/${fileId}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRenameError(data.error ?? "Rename failed")
        setActionLoading(null)
        return // keep input open so user can fix the name
      }
      onRefresh()
      setRenamingId(null)
    } catch {
      setRenameError("Rename failed")
      setActionLoading(null)
      return
    }
    setActionLoading(null)
  }

  function startRename(file: File) {
    renameFreshRef.current = true
    setRenameError(null)
    setRenamingId(file.id)
    setRenameValue(file.originalFilename)
  }

  // ── Move ────────────────────────────────────────────────
  async function handleMove(fileId: string, folderId: string | null) {
    setActionLoading(fileId + "-move")
    try {
      await fetch(`/api/files/${fileId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
      setMovingFile(null)
      onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  // ── Download ────────────────────────────────────────────
  // Fetch the blob via the presigned URL so the browser treats it as a
  // download rather than navigating to it (R2 presigned URLs don't carry
  // Content-Disposition: attachment by default).
  async function handleDownload(fileId: string, filename: string) {
    setActionLoading(fileId + "-download")
    try {
      const res  = await fetch(`/api/files/${fileId}`)
      const data = await res.json()
      if (data.downloadUrl) {
        const blob = await fetch(data.downloadUrl).then((r) => r.blob())
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        onRefresh()
      }
    } finally {
      setActionLoading(null)
    }
  }

  // ── Preview ─────────────────────────────────────────────
  async function handlePreview(file: File) {
    setPreviewFile(file)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      const res  = await fetch(`/api/files/${file.id}`)
      const data = await res.json()
      if (data.downloadUrl) setPreviewUrl(data.downloadUrl)
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Renew ───────────────────────────────────────────────
  async function handleRenew(fileId: string) {
    setActionLoading(fileId + "-renew")
    try {
      await fetch(`/api/files/${fileId}`, { method: "PATCH" })
      onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  // ── Delete ──────────────────────────────────────────────
  async function handleDelete(fileId: string) {
    if (!confirm("Permanently delete this file? This cannot be undone.")) return
    setActionLoading(fileId + "-delete")
    try {
      await fetch(`/api/files/${fileId}`, { method: "DELETE" })
      onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  // ── Versions ────────────────────────────────────────────
  async function openVersions(file: File) {
    setVersionsFile(file)
    setVersionsLoading(true)
    try {
      const res  = await fetch(`/api/files/${file.id}/versions`)
      const data = await res.json()
      setVersions(data.versions ?? [])
    } finally {
      setVersionsLoading(false)
    }
  }

  async function downloadVersion(fileId: string, versionId: string, filename: string) {
    const res  = await fetch(`/api/files/${fileId}/versions/${versionId}`)
    const data = await res.json()
    if (data.downloadUrl) {
      const a = document.createElement("a")
      a.href = data.downloadUrl
      a.download = filename
      a.click()
    }
  }

  async function deleteVersion(fileId: string, versionId: string) {
    if (!confirm("Delete this version? This cannot be undone.")) return
    await fetch(`/api/files/${fileId}/versions/${versionId}`, { method: "DELETE" })
    if (versionsFile) openVersions(versionsFile)
    onRefresh()
  }

  // ── Upload new version ──────────────────────────────────
  async function handleNewVersionUpload(file: File, selectedFile: globalThis.File) {
    setUploadingVersion(true)
    try {
      const metaRes = await fetch(`/api/files/${file.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          sizeBytes: selectedFile.size,
        }),
      })
      if (!metaRes.ok) throw new Error((await metaRes.json()).error)
      const { uploadUrl } = await metaRes.json()
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      })
      setNewVersionFile(null)
      if (versionsFile?.id === file.id) openVersions(file)
      onRefresh()
    } finally {
      setUploadingVersion(false)
    }
  }

  const sorted = [...files].sort((a, b) => b.decayScore - a.decayScore)

  if (folders.length === 0 && files.length === 0) {
    return (
      <div
        className="rounded-xl py-20 text-center"
        style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
      >
        <p className="text-4xl mb-4">📁</p>
        <p className="text-sm font-medium mb-1">No files here</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Drop a file above or create a folder in the sidebar.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {folders.length > 0 && `${folders.length} folder${folders.length !== 1 ? "s" : ""}  · `}
          {files.length} file{files.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onRefresh}
          className="action-btn text-xs flex items-center gap-1.5 px-3 py-1.5"
          style={{ border: "1px solid var(--border)", borderRadius: "8px" }}
        >
          <RefreshCwIcon className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ── Folder cards ────────────────────────────── */}
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onOpenFolder(folder)}
            className="rounded-xl p-5 text-left transition-all group"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <FolderIcon className="w-8 h-8 shrink-0" style={{ color: "var(--accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{folder.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Folder · {formatRelativeTime(folder.createdAt)}
                </p>
              </div>
              <ChevronDownIcon
                className="w-4 h-4 -rotate-90 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--text-dim)" }}
              />
            </div>
          </button>
        ))}

        {/* ── File cards ──────────────────────────────── */}
        {sorted.map((file) => {
          const decayColor = getDecayColor(file.decayScore)
          const decayLabel = getDecayLabel(file.decayScore)
          const daysLeft   = getDaysUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)
          const isCritical = file.decayScore >= 0.75
          const isExpiring = file.decayScore >= 0.9
          const isRenaming = renamingId === file.id

          return (
            <div
              key={file.id}
              className="rounded-xl p-5 flex flex-col gap-3 transition-all"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${isExpiring ? "rgba(239,68,68,0.3)" : isCritical ? "rgba(249,115,22,0.2)" : "var(--border)"}`,
                boxShadow: isExpiring ? "0 0 20px rgba(239,68,68,0.05)" : "none",
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">
                  {getMimeTypeIcon(file.mimeType)}
                </span>
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(file.id)
                          if (e.key === "Escape") { setRenamingId(null); setRenameError(null) }
                        }}
                        onFocus={() => { renameFreshRef.current = false }}
                        onBlur={() => {
                          if (renameFreshRef.current) { renameFreshRef.current = false; return }
                          handleRename(file.id)
                        }}
                        className="w-full text-sm rounded px-2 py-0.5 outline-none"
                        style={{
                          background: "var(--bg-hover)",
                          border: `1px solid ${renameError ? "#ef4444" : "var(--accent)"}`,
                          color: "var(--text)",
                        }}
                      />
                      {renameError && (
                        <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{renameError}</p>
                      )}
                    </div>
                  ) : (
                    <p
                      className="text-sm font-medium truncate cursor-pointer"
                      title="Double-click to rename"
                      onDoubleClick={() => startRename(file)}
                    >
                      {file.originalFilename}
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    {formatBytes(file.sizeBytes)} · v{file.currentVersionNumber} · {formatRelativeTime(file.uploadedAt)}
                  </p>
                </div>
              </div>

              {/* Decay bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: decayColor, fontFamily: "DM Mono, monospace" }}>
                    {decayLabel}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    <ClockIcon className="w-3 h-3" /> {daysLeft}d left
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div
                    className={`h-full rounded-full transition-all${isCritical ? " animate-pulse-slow" : ""}`}
                    style={{ width: `${file.decayScore * 100}%`, background: decayColor }}
                  />
                </div>
              </div>

              {/* Primary actions */}
              <div className="flex items-center gap-1 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => handlePreview(file)}
                  disabled={!!actionLoading}
                  title="Preview"
                  className="action-btn flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md disabled:opacity-50"
                >
                  <EyeIcon className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  onClick={() => handleDownload(file.id, file.originalFilename)}
                  disabled={!!actionLoading}
                  title="Download"
                  className="action-btn flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md disabled:opacity-50"
                >
                  <DownloadIcon className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={() => handleRenew(file.id)}
                  disabled={!!actionLoading}
                  title="Reset decay clock"
                  className="action-btn-green flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md disabled:opacity-50"
                >
                  <RefreshCwIcon className="w-3.5 h-3.5" /> Renew
                </button>

                {/* More actions */}
                <button
                  onClick={() => startRename(file)}
                  disabled={!!actionLoading}
                  title="Rename"
                  className="action-btn p-1.5 rounded-md disabled:opacity-50"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMovingFile(file)}
                  disabled={!!actionLoading}
                  title="Move to folder"
                  className="action-btn p-1.5 rounded-md disabled:opacity-50"
                >
                  <FolderInputIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openVersions(file)}
                  disabled={!!actionLoading}
                  title={`Versions (v${file.currentVersionNumber})`}
                  className="action-btn p-1.5 rounded-md disabled:opacity-50"
                >
                  <GitBranchIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={!!actionLoading}
                  title="Delete permanently"
                  className="action-btn-red p-1.5 rounded-md disabled:opacity-50"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Move to folder modal ─────────────────────────── */}
      {movingFile && (
        <Modal title="Move to folder" onClose={() => setMovingFile(null)}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Moving: <strong style={{ color: "var(--text)" }}>{movingFile.originalFilename}</strong>
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            <button
              onClick={() => handleMove(movingFile.id, null)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
              style={{
                background: movingFile.folderId === null ? "var(--accent-dim)" : "var(--bg-hover)",
                color: movingFile.folderId === null ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              🏠 Root (My Files)
            </button>
            {allFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleMove(movingFile.id, folder.id)}
                disabled={movingFile.folderId === folder.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
                style={{
                  background: movingFile.folderId === folder.id ? "var(--accent-dim)" : "var(--bg-hover)",
                  color: movingFile.folderId === folder.id ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
                {folder.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Version history drawer ───────────────────────── */}
      {versionsFile && (
        <Modal
          title={`Version history — ${versionsFile.originalFilename}`}
          onClose={() => { setVersionsFile(null); setVersions([]) }}
          wide
        >
          {/* Upload new version */}
          <div
            className="rounded-xl p-4 mb-4 flex items-center justify-between"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            <div>
              <p className="text-sm font-medium">Upload new version</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Current: v{versionsFile.currentVersionNumber}
              </p>
            </div>
            <label className="btn-accent text-xs px-4 py-2 rounded-lg cursor-pointer font-medium">
              {uploadingVersion ? "Uploading…" : (
                <span className="flex items-center gap-1.5">
                  <UploadIcon className="w-3.5 h-3.5" /> Upload v{versionsFile.currentVersionNumber + 1}
                </span>
              )}
              <input
                type="file"
                className="hidden"
                disabled={uploadingVersion}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleNewVersionUpload(versionsFile, f)
                }}
              />
            </label>
          </div>

          {/* Version list */}
          {versionsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No versions found</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => {
                const isCurrent = v.versionNumber === versionsFile.currentVersionNumber
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: isCurrent ? "var(--accent-dim)" : "var(--bg-elevated)",
                      border: `1px solid ${isCurrent ? "rgba(245,166,35,0.25)" : "var(--border)"}`,
                    }}
                  >
                    <span
                      className="text-xs font-bold w-8 shrink-0"
                      style={{ color: isCurrent ? "var(--accent)" : "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
                    >
                      v{v.versionNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{v.label ?? `Version ${v.versionNumber}`}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {formatBytes(v.sizeBytes)} · {formatRelativeTime(v.uploadedAt)}
                      </p>
                    </div>
                    {isCurrent && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                      >
                        Current
                      </span>
                    )}
                    <button
                      onClick={() => downloadVersion(versionsFile.id, v.id, versionsFile.originalFilename)}
                      className="action-btn p-1.5 rounded-md shrink-0"
                      title="Download this version"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={() => deleteVersion(versionsFile.id, v.id)}
                        className="action-btn-red p-1.5 rounded-md shrink-0"
                        title="Delete this version"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}
      {/* ── Preview modal ───────────────────────────────── */}
      {previewFile && (
        <Modal
          title={previewFile.originalFilename}
          onClose={() => { setPreviewFile(null); setPreviewUrl(null) }}
          wide
        >
          <div className="flex flex-col gap-4">
            {/* File meta */}
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                {formatBytes(previewFile.sizeBytes)} · {previewFile.mimeType}
              </p>
              <button
                onClick={() => handleDownload(previewFile.id, previewFile.originalFilename)}
                className="action-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
              >
                <DownloadIcon className="w-3.5 h-3.5" /> Download
              </button>
            </div>

            {/* Preview area */}
            <div
              className="rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: "var(--bg-elevated)", minHeight: "240px", border: "1px solid var(--border)" }}
            >
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
                  <p className="text-xs">Loading preview…</p>
                </div>
              ) : !previewUrl ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Preview unavailable</p>
              ) : previewFile.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewFile.originalFilename} className="max-w-full max-h-[60vh] object-contain" />
              ) : previewFile.mimeType.startsWith("video/") ? (
                <video src={previewUrl} controls className="max-w-full max-h-[60vh]" />
              ) : previewFile.mimeType.startsWith("audio/") ? (
                <audio src={previewUrl} controls className="w-full" />
              ) : previewFile.mimeType === "application/pdf" ? (
                <iframe src={previewUrl} className="w-full rounded-xl" style={{ height: "60vh" }} />
              ) : previewFile.mimeType.startsWith("text/") ? (
                <TextPreview url={previewUrl} />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8" style={{ color: "var(--text-muted)" }}>
                  <span className="text-5xl">{getMimeTypeIcon(previewFile.mimeType)}</span>
                  <p className="text-sm text-center">No preview available for this file type.</p>
                  <button
                    onClick={() => handleDownload(previewFile.id, previewFile.originalFilename)}
                    className="action-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md mt-1"
                  >
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

// ── Text file preview (fetches and renders plain text) ────
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  // useEffect so the fetch runs after mount, not during render
  // We inline it via a ref+flag pattern to avoid importing useEffect at top level
  const fetchedRef = useRef(false)
  if (!fetchedRef.current) {
    fetchedRef.current = true
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText("Could not load text."))
  }
  return (
    <pre
      className="w-full max-h-96 overflow-auto text-xs p-4 rounded-xl"
      style={{ background: "var(--bg-elevated)", color: "var(--text)", fontFamily: "DM Mono, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {text ?? "Loading…"}
    </pre>
  )
}

// ── Reusable modal shell ─────────────────────────────────
function Modal({
  title, onClose, children, wide = false
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`rounded-2xl p-6 w-full ${wide ? "max-w-lg" : "max-w-sm"}`}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="action-btn p-1.5 rounded-lg">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}