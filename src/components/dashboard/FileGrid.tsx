"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import {
  RefreshCwIcon, Trash2Icon, DownloadIcon, ClockIcon,
  FolderIcon, PencilIcon, FolderInputIcon, GitBranchIcon,
  UploadIcon, XIcon, ChevronDownIcon, EyeIcon, MoreHorizontalIcon,
  AlertTriangleIcon, CheckIcon, UploadCloudIcon, InfoIcon,
  SearchIcon, SlidersHorizontalIcon, Share2Icon, LinkIcon, GlobeIcon, LockIcon,
  CheckSquareIcon, SquareIcon, SquareSlashIcon, TagIcon, PlusIcon,
} from "lucide-react"
import { formatBytes, formatRelativeTime, formatDateTime, getMimeTypeIcon } from "@/lib/utils"
import { getDecayColor, getDecayLabel, getDaysUntilDeletion, getTimeUntilDeletion, calculateDecayScore } from "@/lib/decay-utils"
import { HelpTooltip } from "@/components/dashboard/HelpTooltip"
import type { File, Folder, FileVersion } from "@/lib/db/schema"

// ─── MIME-type category helpers ───────────────────────────
type FileCategory = "all" | "images" | "documents" | "video" | "audio" | "archives"
type SortKey = "decay" | "name" | "size" | "date"

function getCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "images"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.ms-powerpoint"
  )
    return "documents"
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/gzip"
  )
    return "archives"
  return "documents" // fallback — shows under Documents
}

interface Props {
  files: File[]
  folders: Folder[]
  allFolders: Folder[]
  currentFolderId: string | null
  userPlan?: "free" | "starter" | "pro"
  onRefresh: () => void
  onOpenFolder: (folder: Folder) => void
  /** Called when a file is renewed — fires a toast in the parent */
  onRenewedToast?: (filename: string) => void
  /** Ref so parent (dashboard page) can call handleRenew for notification actions */
  renewFileRef?: React.MutableRefObject<((fileId: string) => Promise<void>) | null>
  /** [P12-4] Ref so parent can focus search input via keyboard shortcut (/) */
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>
}

type ActionKey = string

export function FileGrid({
  files, folders, allFolders, currentFolderId, userPlan,
  onRefresh, onOpenFolder, onRenewedToast, renewFileRef, searchInputRef,
}: Props) {
  const [localFiles, setLocalFiles]             = useState<File[]>(files)
  useEffect(() => { setLocalFiles(files) }, [files])

  const [loadingKeys, setLoadingKeys]           = useState<Set<ActionKey>>(new Set())
  const [renamingId, setRenamingId]             = useState<string | null>(null)
  const [renameValue, setRenameValue]           = useState("")
  const [renameError, setRenameError]           = useState<string | null>(null)
  const [movingFile, setMovingFile]             = useState<File | null>(null)
  const [versionsFile, setVersionsFile]         = useState<File | null>(null)
  const [versions, setVersions]                 = useState<FileVersion[]>([])
  const [versionsLoading, setVersionsLoading]   = useState(false)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [versionProgress, setVersionProgress]   = useState(0)
  const [previewFile, setPreviewFile]           = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null)
  const [previewLoading, setPreviewLoading]     = useState(false)
  const [openMenuId, setOpenMenuId]             = useState<string | null>(null)
  const [confirmState, setConfirmState]         = useState<{ id: string; action: "delete" | "deleteVersion"; versionId?: string } | null>(null)
  const [renewedId, setRenewedId]               = useState<string | null>(null)
  const [detailsFile, setDetailsFile]           = useState<File | null>(null)
  const renameFreshRef = useRef(false)

  // ── [P7-1] Search / sort / filter state ───────────────────
  const [searchQuery, setSearchQuery]     = useState("")
  const [sortKey, setSortKey]             = useState<SortKey>("decay")
  const [filterCat, setFilterCat]         = useState<FileCategory>("all")

  // ── [P7-2] Bulk selection state ────────────────────────────
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [bulkMoving, setBulkMoving]           = useState(false)
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false)
  const [bulkLoading, setBulkLoading]         = useState(false)

  // ── [P7-3] Public share state ──────────────────────────────
  const [togglingPublic, setTogglingPublic]   = useState(false)
  const [copiedLink, setCopiedLink]           = useState(false)

  // ── [P9-4] Drag-and-drop state ────────────────────────────
  const [dragFileId, setDragFileId]           = useState<string | null>(null)
  const [dropTargetId, setDropTargetId]       = useState<string | null>(null)

  // ── [P9-2] Tag state ───────────────────────────────────────
  const [tagInput, setTagInput]               = useState("")
  const [savingTag, setSavingTag]             = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  function startLoading(key: ActionKey) { setLoadingKeys((p) => new Set(p).add(key)) }
  function stopLoading(key: ActionKey)  { setLoadingKeys((p) => { const s = new Set(p); s.delete(key); return s }) }
  function isLoading(key: ActionKey)    { return loadingKeys.has(key) }

  async function handleRename(fileId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    setRenamingId(null); setRenameError(null)
    setLocalFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, originalFilename: trimmed } : f))
    const res  = await fetch(`/api/files/${fileId}/rename`, {
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
      // Fire toast in parent
      const file = localFiles.find((f) => f.id === fileId)
      if (file && onRenewedToast) onRenewedToast(file.originalFilename)
      onRefresh()
    } catch {
      onRefresh()
    } finally {
      stopLoading(key)
    }
  }

  // Expose handleRenew to parent via ref (for notification actions)
  useEffect(() => {
    if (renewFileRef) renewFileRef.current = handleRenew
  })

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

  // ── [P7-1] Search → filter → sort pipeline ────────────────
  // [P9-2] Collect all unique tags across all files for the tag filter row
  const allTags = useMemo(() => {
    const set = new Set<string>()
    localFiles.forEach((f) => f.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [localFiles])

  const displayFiles = useMemo(() => {
    let result = localFiles
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((f) => f.originalFilename.toLowerCase().includes(q))
    }
    if (filterCat !== "all") {
      result = result.filter((f) => getCategory(f.mimeType) === filterCat)
    }
    // [P9-2] Tag filter
    if (activeTagFilter) {
      result = result.filter((f) => f.tags?.includes(activeTagFilter))
    }
    return [...result].sort((a, b) => {
      switch (sortKey) {
        case "name":  return a.originalFilename.localeCompare(b.originalFilename)
        case "size":  return b.sizeBytes - a.sizeBytes
        case "date":  return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        default:      return b.decayScore - a.decayScore
      }
    })
  }, [localFiles, searchQuery, filterCat, sortKey, activeTagFilter])

  // ── [P7-2] Bulk helpers ────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function selectAll()      { setSelectedIds(new Set(displayFiles.map((f) => f.id))) }
  function clearSelection() { setSelectedIds(new Set()) }

  async function handleBulkRenew() {
    setBulkLoading(true)
    const ids = Array.from(selectedIds)
    for (let i = 0; i < ids.length; i += 4)
      await Promise.all(ids.slice(i, i + 4).map((id) => fetch(`/api/files/${id}`, { method: "PATCH" })))
    clearSelection(); setBulkLoading(false); onRefresh()
  }

  async function handleBulkDelete() {
    setBulkLoading(true); setBulkConfirmDelete(false)
    const ids = Array.from(selectedIds)
    for (let i = 0; i < ids.length; i += 4)
      await Promise.all(ids.slice(i, i + 4).map((id) => fetch(`/api/files/${id}`, { method: "DELETE" })))
    clearSelection(); setBulkLoading(false); onRefresh()
  }

  async function handleBulkMove(folderId: string | null) {
    setBulkLoading(true); setBulkMoving(false)
    const ids = Array.from(selectedIds)
    for (let i = 0; i < ids.length; i += 4)
      await Promise.all(ids.slice(i, i + 4).map((id) =>
        fetch(`/api/files/${id}/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId }) })
      ))
    clearSelection(); setBulkLoading(false); onRefresh()
  }

  // ── [P7-3] Public share helpers ────────────────────────────
  async function handleTogglePublic(file: File) {
    setTogglingPublic(true)
    const newVal = !file.isPublic
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newVal }),
      })
      if (res.ok) {
        setLocalFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, isPublic: newVal } : f))
        setDetailsFile((d) => d?.id === file.id ? { ...d, isPublic: newVal } : d)
      }
    } finally { setTogglingPublic(false) }
  }

  function copyShareLink(fileId: string) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${fileId}`)
      .then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) })
  }

  // ── [P9-4] Drag-and-drop handlers ─────────────────────────
  function onFileDragStart(e: React.DragEvent, fileId: string) {
    setDragFileId(fileId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", fileId)
  }

  function onFileDragEnd() {
    setDragFileId(null)
    setDropTargetId(null)
  }

  function onFolderDragOver(e: React.DragEvent, folderId: string) {
    if (!dragFileId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTargetId(folderId)
  }

  function onFolderDragLeave() {
    setDropTargetId(null)
  }

  async function onFolderDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault()
    const fileId = e.dataTransfer.getData("text/plain") || dragFileId
    setDragFileId(null)
    setDropTargetId(null)
    if (!fileId || fileId === folderId) return
    await handleMove(fileId, folderId)
  }

  // [P9-2] Add / remove tags — PATCH /api/files/[id] with { tags }
  async function handleAddTag(file: File, tag: string) {
    const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
    if (!clean || file.tags.includes(clean)) { setTagInput(""); return }
    const newTags = [...file.tags, clean]
    setSavingTag(true)
    setDetailsFile((d) => d?.id === file.id ? { ...d, tags: newTags } : d)
    setLocalFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, tags: newTags } : f))
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    })
    setSavingTag(false)
    setTagInput("")
  }

  async function handleRemoveTag(file: File, tag: string) {
    const newTags = file.tags.filter((t) => t !== tag)
    setDetailsFile((d) => d?.id === file.id ? { ...d, tags: newTags } : d)
    setLocalFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, tags: newTags } : f))
    await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    })
  }

  // ─── Rich empty state ──────────────────────────────────────────
  if (folders.length === 0 && files.length === 0) {
    return (
      <div
        className="rounded-xl py-16 sm:py-20 px-6 text-center flex flex-col items-center gap-4"
        style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          {currentFolderId
            ? <FolderIcon className="w-8 h-8" style={{ color: "var(--accent)" }} />
            : <UploadCloudIcon className="w-8 h-8" style={{ color: "var(--accent)" }} />
          }
        </div>
        <div>
          <p className="text-base font-semibold mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
            {currentFolderId ? "This folder is empty" : "No files yet"}
          </p>
          <p className="text-sm max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
            {currentFolderId
              ? "Upload files here or move existing files into this folder using the ⋯ menu."
              : "Drop files in the upload zone above, or tap it to browse. Files decay if untouched — keep them alive by downloading or renewing."}
          </p>
        </div>
        {!currentFolderId && (
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} /> Fresh
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#eab308" }} /> Stale
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} /> Deleted
            </span>
          </div>
        )}
      </div>
    )
  }

  const CAT_LABELS: Record<FileCategory, string> = {
    all: "All", images: "Images", documents: "Documents",
    video: "Video", audio: "Audio", archives: "Archives",
  }

  return (
    <>
      {/* ── [P7-1] Search / Sort / Filter toolbar ── */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--text-dim)" }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-dim)" }}>
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <option value="decay">↓ Decay</option>
            <option value="name">A–Z Name</option>
            <option value="size">↓ Size</option>
            <option value="date">↓ Date</option>
          </select>
          <button onClick={onRefresh} className="action-btn text-xs flex items-center gap-1.5 px-3 py-1.5" style={{ border: "1px solid var(--border)", borderRadius: "8px" }}>
            <RefreshCwIcon className="w-3 h-3" />
          </button>
        </div>
        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(CAT_LABELS) as FileCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: filterCat === cat ? "var(--accent)" : "var(--bg-elevated)",
                color: filterCat === cat ? "#000" : "var(--text-muted)",
                border: `1px solid ${filterCat === cat ? "var(--accent)" : "var(--border)"}`,
                fontWeight: filterCat === cat ? 600 : 400,
              }}
            >
              {CAT_LABELS[cat]}
            </button>
          ))}
          <span className="ml-auto text-xs self-center" style={{ color: "var(--text-dim)" }}>
            {folders.length > 0 && `${folders.length} folder${folders.length !== 1 ? "s" : ""} · `}
            {displayFiles.length}/{files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* [P9-2] Tag filter pills — only shown when files have tags */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <TagIcon className="w-3 h-3 shrink-0" style={{ color: "var(--text-dim)" }} />
            {activeTagFilter && (
              <button
                onClick={() => setActiveTagFilter(null)}
                className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)" }}
              >
                <XIcon className="w-2.5 h-2.5" /> Clear
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                className="text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: activeTagFilter === tag ? "var(--accent)" : "var(--bg-elevated)",
                  color: activeTagFilter === tag ? "#000" : "var(--text-muted)",
                  border: `1px solid ${activeTagFilter === tag ? "var(--accent)" : "var(--border)"}`,
                  fontWeight: activeTagFilter === tag ? 600 : 400,
                  fontFamily: "DM Mono, monospace",
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* [P9-4] Drag hint — appears while dragging */}
      {dragFileId && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full text-xs font-medium pointer-events-none animate-fade-in"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent)", color: "var(--accent)", boxShadow: "0 4px 20px var(--accent-glow)" }}
        >
          Drop onto a folder to move
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Folder cards */}
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => onOpenFolder(folder)}
            onDragOver={(e) => onFolderDragOver(e, folder.id)}
            onDragLeave={onFolderDragLeave}
            onDrop={(e) => onFolderDrop(e, folder.id)}
            className="rounded-xl p-4 sm:p-5 text-left transition-all group"
            style={{
              background: dropTargetId === folder.id ? "var(--accent-dim)" : "var(--bg-card)",
              border: `1px solid ${dropTargetId === folder.id ? "var(--accent)" : "var(--border)"}`,
              transform: dropTargetId === folder.id ? "scale(1.02)" : "scale(1)",
              transition: "background 0.15s, border-color 0.15s, transform 0.15s",
            }}
          >
            <div className="flex items-center gap-3">
              <FolderIcon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" style={{ color: "var(--accent)" }} />
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

        {/* File cards */}
        {displayFiles.map((file) => {
          const liveDecayScore      = calculateDecayScore(new Date(file.lastAccessedAt), file.decayRateDays)
          const decayColor          = getDecayColor(liveDecayScore)
          const decayLabel          = getDecayLabel(liveDecayScore)
          const timeLeft            = getTimeUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)
          const isCritical          = liveDecayScore >= 0.75
          const isExpiring          = liveDecayScore >= 0.9
          const isRenaming          = renamingId === file.id
          const isDeleting          = isLoading(file.id + "-delete")
          const isDownloading       = isLoading(file.id + "-download")
          const isRenewing          = isLoading(file.id + "-renew")
          const isConfirmingDelete  = confirmState?.id === file.id && confirmState.action === "delete"
          const isRenewed           = renewedId === file.id
          const isSelected          = selectedIds.has(file.id)

          return (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => onFileDragStart(e, file.id)}
              onDragEnd={onFileDragEnd}
              className="rounded-xl p-4 sm:p-5 flex flex-col gap-3 transition-all group/card relative"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${isSelected ? "var(--accent)" : isExpiring ? "rgba(239,68,68,0.3)" : isCritical ? "rgba(249,115,22,0.2)" : "var(--border)"}`,
                boxShadow: isSelected ? "0 0 0 2px var(--accent-dim)" : isExpiring ? "0 0 20px rgba(239,68,68,0.05)" : "none",
                opacity: dragFileId === file.id ? 0.4 : isDeleting ? 0.5 : 1,
                cursor: "grab",
                transition: "opacity 0.15s",
              }}
            >
              {/* [P7-2] Checkbox — shows on hover or when anything is selected */}
              <button
                onClick={() => toggleSelect(file.id)}
                className={`absolute top-3 left-3 z-10 rounded-md transition-opacity ${selectedIds.size > 0 || isSelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"}`}
                title={isSelected ? "Deselect" : "Select"}
                aria-label={isSelected ? `Deselect ${file.originalFilename}` : `Select ${file.originalFilename}`}
                aria-pressed={isSelected}
              >
                {isSelected
                  ? <CheckSquareIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  : <SquareIcon className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
                }
              </button>
              {/* File info row */}
              <div className="flex items-start gap-3">
                <span className="text-xl sm:text-2xl leading-none mt-0.5 shrink-0">
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
                        onBlur={() => { if (renameFreshRef.current) { renameFreshRef.current = false; return } handleRename(file.id) }}
                        className="w-full text-sm rounded px-2 py-0.5 outline-none"
                        style={{
                          background: "var(--bg-hover)",
                          border: `1px solid ${renameError ? "#ef4444" : "var(--accent)"}`,
                          color: "var(--text)",
                        }}
                      />
                      {renameError && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{renameError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/name">
                      <p
                        className="text-sm font-medium truncate cursor-pointer"
                        title="Double-click to rename"
                        onDoubleClick={() => startRename(file)}
                      >
                        {file.originalFilename}
                      </p>
                      <button
                        onClick={() => startRename(file)}
                        className="shrink-0 p-0.5 rounded opacity-0 group-hover/name:opacity-100 transition-opacity"
                        style={{ color: "var(--text-dim)" }}
                        title="Rename"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    {formatBytes(file.sizeBytes)} · v{file.currentVersionNumber} · {formatRelativeTime(file.uploadedAt)}
                  </p>
                </div>
              </div>

              {/* Decay bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  {isRenewed ? (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#34d399" }}>
                      <CheckIcon className="w-3 h-3" /> Renewed!
                    </span>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: decayColor, fontFamily: "DM Mono, monospace" }}>
                      {decayLabel}
                    </span>
                  )}
                  <span
                    className="text-xs flex items-center gap-1 cursor-help"
                    title="Decay timer resets when you download or preview. Use Renew to reset manually."
                    style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
                  >
                    <ClockIcon className="w-3 h-3" />
                    {isRenewed ? `${file.decayRateDays}d left` : `${timeLeft} left`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div
                    className={`h-full rounded-full transition-all duration-700${isCritical && !isRenewed ? " animate-pulse-slow" : ""}`}
                    style={{
                      width: isRenewed ? "0%" : `${liveDecayScore * 100}%`,
                      background: isRenewed ? "#34d399" : decayColor,
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              {isConfirmingDelete ? (
                <div
                  className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <AlertTriangleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                  <p className="text-xs flex-1 leading-snug" style={{ color: "#ef4444" }}>
                    Permanently delete? Cannot be undone.
                  </p>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    <CheckIcon className="w-3 h-3" /> Yes
                  </button>
                  <button onClick={() => setConfirmState(null)} className="action-btn p-1 rounded-lg shrink-0">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1 pt-1"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  {/* Primary actions — always visible */}
                  <button
                    onClick={() => handlePreview(file)}
                    className="action-btn flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg min-w-0"
                    title="Preview"
                  >
                    <EyeIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Preview</span>
                  </button>
                  <button
                    onClick={() => handleDownload(file.id, file.originalFilename)}
                    disabled={isDownloading}
                    className="action-btn flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg disabled:opacity-60 min-w-0"
                    title="Download"
                  >
                    {isDownloading ? (
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                        style={{ borderColor: "var(--border)", borderTopColor: "var(--text-muted)" }}
                      />
                    ) : (
                      <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden sm:inline truncate">
                      {isDownloading ? "…" : "Download"}
                    </span>
                  </button>
                  <button
                    onClick={() => handleRenew(file.id)}
                    disabled={isRenewing || isRenewed}
                    className="action-btn-green flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg disabled:opacity-60 min-w-0"
                    title="Reset decay timer"
                  >
                    {isRenewing ? (
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                        style={{ borderColor: "rgba(52,211,153,0.3)", borderTopColor: "#34d399" }}
                      />
                    ) : isRenewed ? (
                      <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <RefreshCwIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden sm:inline truncate">
                      {isRenewing ? "…" : isRenewed ? "Done!" : "Renew"}
                    </span>
                  </button>

                  {/* Overflow menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === file.id ? null : file.id)}
                      className="action-btn p-1.5 rounded-lg"
                      title="More actions"
                    >
                      <MoreHorizontalIcon className="w-4 h-4" />
                    </button>
                    {openMenuId === file.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div
                          className="absolute right-0 bottom-full mb-1.5 z-20 rounded-xl overflow-hidden py-1 min-w-[160px]"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                          }}
                        >
                          <button
                            onClick={() => { startRename(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <PencilIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Rename
                          </button>
                          <button
                            onClick={() => { setMovingFile(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <FolderInputIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Move to folder
                          </button>
                          <button
                            onClick={() => { openVersions(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <GitBranchIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Versions (v{file.currentVersionNumber})
                          </button>
                          <button
                            onClick={() => { setDetailsFile(file); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <InfoIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Details
                          </button>
                          {userPlan === "pro" && (
                            <div className="flex items-center">
                              <button
                                onClick={() => { handleTogglePublic(file); setOpenMenuId(null) }}
                                className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                              >
                                {file.isPublic
                                  ? <><LockIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Make private</>
                                  : <><GlobeIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Share publicly</>
                                }
                              </button>
                              <span className="pr-2">
                                <HelpTooltip
                                  content="Creates a public link. Anyone with the link can view and download. Each visit resets the file's decay clock."
                                  guideAnchor="pro"
                                  position="left"
                                />
                              </span>
                            </div>
                          )}
                          {userPlan === "pro" && file.isPublic && (
                            <button
                              onClick={() => { copyShareLink(file.id); setOpenMenuId(null) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                            >
                              <LinkIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> Copy link
                            </button>
                          )}
                          <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />
                          <button
                            onClick={() => { setConfirmState({ id: file.id, action: "delete" }); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ color: "#ef4444" }}
                          >
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

      {/* ── [P7-2] Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label={`${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""} selected`}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
        >
          <button onClick={clearSelection} className="p-1 rounded-md" style={{ color: "var(--text-dim)" }} title="Clear selection" aria-label="Clear selection">
            <XIcon className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-2" style={{ color: "var(--text-muted)" }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: "1px", height: 20, background: "var(--border)" }} />
          <button
            onClick={() => { if (selectedIds.size < displayFiles.length) selectAll(); else clearSelection() }}
            className="action-btn text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <SquareSlashIcon className="w-3.5 h-3.5" />
            {selectedIds.size < displayFiles.length ? "All" : "None"}
          </button>
          <button
            onClick={handleBulkRenew}
            disabled={bulkLoading}
            className="action-btn-green text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" /> Renew all
          </button>
          <button
            onClick={() => setBulkMoving(true)}
            disabled={bulkLoading}
            className="action-btn text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
          >
            <FolderInputIcon className="w-3.5 h-3.5" /> Move to
          </button>
          {bulkConfirmDelete ? (
            <>
              <span className="text-xs" style={{ color: "#ef4444" }}>Delete {selectedIds.size}?</span>
              <button onClick={handleBulkDelete} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold" style={{ background: "#ef4444", color: "#fff" }}>
                Yes
              </button>
              <button onClick={() => setBulkConfirmDelete(false)} className="action-btn p-1.5 rounded-lg">
                <XIcon className="w-3 h-3" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setBulkConfirmDelete(true)}
              disabled={bulkLoading}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
            >
              <Trash2Icon className="w-3.5 h-3.5" /> Delete all
            </button>
          )}
        </div>
      )}

      {/* ── [P7-2] Bulk move modal ── */}
      {bulkMoving && (
        <Modal title={`Move ${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""}`} onClose={() => setBulkMoving(false)}>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            <button
              onClick={() => handleBulkMove(null)}
              disabled={bulkLoading}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
              style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
            >
              <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} /> Root (My Files)
            </button>
            {allFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleBulkMove(folder.id)}
                disabled={bulkLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
              >
                <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /> {folder.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Move modal */}
      {movingFile && (
        <Modal title="Move to folder" onClose={() => setMovingFile(null)}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Moving: <strong style={{ color: "var(--text)" }}>{movingFile.originalFilename}</strong>
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            <button
              onClick={() => handleMove(movingFile.id, null)}
              disabled={isLoading(movingFile.id + "-move")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
              style={{
                background: movingFile.folderId === null ? "var(--accent-dim)" : "var(--bg-hover)",
                color: movingFile.folderId === null ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} /> Root (My Files)
            </button>
            {allFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleMove(movingFile.id, folder.id)}
                disabled={movingFile.folderId === folder.id || isLoading(movingFile.id + "-move")}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors disabled:opacity-50"
                style={{
                  background: movingFile.folderId === folder.id ? "var(--accent-dim)" : "var(--bg-hover)",
                  color: movingFile.folderId === folder.id ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <FolderIcon className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /> {folder.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Version history modal */}
      {versionsFile && (
        <Modal
          title={`Version history — ${versionsFile.originalFilename}`}
          onClose={() => { setVersionsFile(null); setVersions([]) }}
          wide
        >
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium">Upload new version</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Current: v{versionsFile.currentVersionNumber}</p>
              </div>
              <label className="btn-accent text-xs px-4 py-2 rounded-lg cursor-pointer font-medium">
                {uploadingVersion
                  ? "Uploading…"
                  : <span className="flex items-center gap-1.5"><UploadIcon className="w-3.5 h-3.5" /> Upload v{versionsFile.currentVersionNumber + 1}</span>
                }
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingVersion}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNewVersionUpload(versionsFile, f) }}
                />
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
                const isConfirmingVersionDelete =
                  confirmState?.id === versionsFile.id &&
                  confirmState.action === "deleteVersion" &&
                  confirmState.versionId === v.id
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 flex-wrap"
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
                    {isConfirmingVersionDelete ? (
                      <>
                        <span className="text-xs shrink-0" style={{ color: "#ef4444" }}>Delete?</span>
                        <button
                          onClick={() => handleDeleteVersion(versionsFile.id, v.id)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold shrink-0"
                          style={{ background: "#ef4444", color: "#fff" }}
                        >
                          Yes
                        </button>
                        <button onClick={() => setConfirmState(null)} className="action-btn p-1 rounded-md shrink-0">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => downloadVersion(versionsFile.id, v.id, versionsFile.originalFilename)}
                          className="action-btn p-1.5 rounded-md shrink-0"
                          title="Download this version"
                        >
                          <DownloadIcon className="w-3.5 h-3.5" />
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => setConfirmState({ id: versionsFile.id, action: "deleteVersion", versionId: v.id })}
                            className="action-btn-red p-1.5 rounded-md shrink-0"
                            title="Delete this version"
                          >
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

      {/* Preview modal */}
      {previewFile && (
        <Modal
          title={previewFile.originalFilename}
          onClose={() => { setPreviewFile(null); setPreviewUrl(null) }}
          fullscreen
        >
          <div className="flex flex-col gap-3 overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
              <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                {formatBytes(previewFile.sizeBytes)} · {previewFile.mimeType}
              </p>
              <button
                onClick={() => handleDownload(previewFile.id, previewFile.originalFilename)}
                disabled={isLoading(previewFile.id + "-download")}
                className="action-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md disabled:opacity-60"
              >
                {isLoading(previewFile.id + "-download") ? (
                  <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--text-muted)" }} />Fetching…</>
                ) : <><DownloadIcon className="w-3.5 h-3.5" /> Download</>}
              </button>
            </div>
            <div
              className="rounded-xl overflow-auto flex items-center justify-center"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", flex: 1, minHeight: 0 }}
            >
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
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
                <PdfPreview url={previewUrl} filename={previewFile.originalFilename} />
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
      {/* Details modal */}
      {detailsFile && (() => {
        const liveScore = calculateDecayScore(new Date(detailsFile.lastAccessedAt), detailsFile.decayRateDays)
        const color     = getDecayColor(liveScore)
        const label     = getDecayLabel(liveScore)
        const timeLeft  = getTimeUntilDeletion(new Date(detailsFile.lastAccessedAt), detailsFile.decayRateDays)

        function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
          return (
            <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs shrink-0" style={{ color: "var(--text-muted)", minWidth: 120 }}>{label}</span>
              <span className="text-xs text-right break-all" style={{ color: "var(--text)", fontFamily: mono ? "DM Mono, monospace" : undefined }}>{value}</span>
            </div>
          )
        }

        return (
          <Modal title="File details" onClose={() => setDetailsFile(null)}>
            {/* Icon + name header */}
            <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-3xl leading-none shrink-0">{getMimeTypeIcon(detailsFile.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{detailsFile.originalFilename}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>{detailsFile.mimeType}</p>
              </div>
            </div>

            {/* Decay health strip */}
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
              style={{ background: "var(--bg-elevated)", border: `1px solid ${color}33` }}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold" style={{ color, fontFamily: "DM Mono, monospace" }}>{label} — {(liveScore * 100).toFixed(1)}% decayed</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>{timeLeft} left</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full" style={{ width: `${liveScore * 100}%`, background: color, transition: "width 0.4s" }} />
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 280px)" }}>
              <Row label="File name"      value={detailsFile.originalFilename} />
              <Row label="Size"           value={formatBytes(detailsFile.sizeBytes)} mono />
              <Row label="Type"           value={detailsFile.mimeType} mono />
              <Row label="Version"        value={`v${detailsFile.currentVersionNumber}`} mono />
              <Row label="Status"         value={
                <span className="capitalize px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: detailsFile.status === "active" ? "rgba(52,211,153,0.12)" : detailsFile.status === "critical" ? "rgba(239,68,68,0.12)" : "rgba(249,115,22,0.12)",
                    color: detailsFile.status === "active" ? "#34d399" : detailsFile.status === "critical" ? "#ef4444" : "#f97316",
                  }}
                >{detailsFile.status}</span>
              } />
              <Row label="Uploaded"       value={formatDateTime(detailsFile.uploadedAt)} />
              <Row label="Last accessed"  value={formatDateTime(detailsFile.lastAccessedAt)} />
              {detailsFile.warnedAt && (
                <Row label="Warned at"    value={formatDateTime(detailsFile.warnedAt)} />
              )}
              <Row label="Decay rate"     value={`${detailsFile.decayRateDays} days to expiry`} mono />
              <Row label="Decay score"    value={`${(liveScore * 100).toFixed(2)}%`} mono />
              <Row label="Time remaining" value={timeLeft} mono />
              <Row label="Visibility" value={
                userPlan === "pro" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePublic(detailsFile)}
                      disabled={togglingPublic}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors disabled:opacity-60"
                      style={{
                        background: detailsFile.isPublic ? "rgba(52,211,153,0.12)" : "var(--bg-hover)",
                        color: detailsFile.isPublic ? "#34d399" : "var(--text-muted)",
                        border: `1px solid ${detailsFile.isPublic ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
                      }}
                    >
                      {detailsFile.isPublic ? <GlobeIcon className="w-3 h-3" /> : <LockIcon className="w-3 h-3" />}
                      {detailsFile.isPublic ? "Public" : "Private"}
                    </button>
                    {detailsFile.isPublic && (
                      <button
                        onClick={() => copyShareLink(detailsFile.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
                        style={{ background: "var(--bg-hover)", color: copiedLink ? "#34d399" : "var(--text-muted)", border: "1px solid var(--border)" }}
                      >
                        {copiedLink ? <CheckIcon className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                        {copiedLink ? "Copied!" : "Copy link"}
                      </button>
                    )}
                  </div>
                ) : (
                  <span>{detailsFile.isPublic ? "Public" : "Private"}</span>
                )
              } />
              {detailsFile.description && (
                <Row label="Description"  value={detailsFile.description} />
              )}
              {/* [P9-2] Tags */}
              <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="text-xs shrink-0 flex items-center gap-1.5" style={{ color: "var(--text-muted)", minWidth: 120 }}>
                  <TagIcon className="w-3 h-3" /> Tags
                </span>
                <div className="flex-1 flex flex-col gap-1.5 items-end">
                  {/* Existing tags */}
                  {(detailsFile.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {detailsFile.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(245,166,35,0.3)", fontFamily: "DM Mono, monospace" }}
                        >
                          #{tag}
                          <button
                            onClick={() => handleRemoveTag(detailsFile, tag)}
                            className="ml-0.5 hover:opacity-60 transition-opacity"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <XIcon className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Add tag input */}
                  {detailsFile.tags.length < 10 && (
                    <div className="flex gap-1 w-full justify-end">
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && tagInput.trim()) handleAddTag(detailsFile, tagInput)
                          if (e.key === "Escape") setTagInput("")
                        }}
                        placeholder="add tag…"
                        maxLength={30}
                        className="text-xs px-2 py-1 rounded-lg outline-none flex-1 min-w-0"
                        style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "DM Mono, monospace" }}
                      />
                      <button
                        onClick={() => { if (tagInput.trim()) handleAddTag(detailsFile, tagInput) }}
                        disabled={!tagInput.trim() || savingTag}
                        className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-40 transition-opacity"
                        style={{ background: "var(--accent)", color: "#000", fontWeight: 600 }}
                      >
                        {savingTag ? "…" : "Add"}
                      </button>
                    </div>
                  )}
                  {detailsFile.tags.length === 0 && !tagInput && (
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>No tags yet</span>
                  )}
                </div>
              </div>
              <Row label="File ID"        value={detailsFile.id} mono />
            </div>

            {/* Footer actions */}
            <div className="flex gap-2 mt-4 pt-4 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => { handleRenew(detailsFile.id); setDetailsFile(null) }}
                className="action-btn-green flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium"
              >
                <RefreshCwIcon className="w-3.5 h-3.5" /> Renew
              </button>
              <button
                onClick={() => { handleDownload(detailsFile.id, detailsFile.originalFilename); setDetailsFile(null) }}
                className="action-btn flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium"
              >
                <DownloadIcon className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </Modal>
        )
      })()}
    </>
  )
}

function PdfPreview({ url, filename }: { url: string; filename: string }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    // Detect mobile/iOS where iframe PDF is blocked
    const ua = navigator.userAgent
    const mobile = /iPhone|iPad|iPod|Android/i.test(ua)
    setIsMobile(mobile)
  }, [])

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-5xl">📄</span>
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
            PDF Preview
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            In-browser PDF preview is not supported on mobile. Download the file to view it.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <DownloadIcon className="w-3.5 h-3.5" /> Open PDF
        </a>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      title={filename}
      className="w-full h-full rounded-xl"
      style={{ minHeight: "70vh", border: "none" }}
    />
  )
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText("Could not load text."))
  }, [url])
  return (
    <pre
      className="w-full max-h-96 overflow-auto text-xs p-4 rounded-xl"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--text)",
        fontFamily: "DM Mono, monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text ?? "Loading…"}
    </pre>
  )
}

function Modal({
  title, onClose, children, wide = false, fullscreen = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  fullscreen?: boolean
}) {
  // Lock body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`rounded-2xl w-full flex flex-col ${
          fullscreen ? "sm:max-w-6xl p-4 sm:p-6" : wide ? "sm:max-w-2xl p-4 sm:p-6" : "max-w-sm p-4 sm:p-6"
        }`}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          maxHeight: fullscreen ? "92vh" : "85vh",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-base font-semibold truncate pr-4">{title}</h3>
          <button onClick={onClose} className="action-btn p-1.5 rounded-lg shrink-0">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}