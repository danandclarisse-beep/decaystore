"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  UploadCloudIcon, CheckCircleIcon, XCircleIcon,
  XIcon, RefreshCwIcon, FileIcon, FingerprintIcon,
  ClockIcon, ChevronDownIcon,
} from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { HelpTooltip } from "@/components/dashboard/HelpTooltip"

interface Props {
  onUploadComplete: () => void
  plan: string
  currentFolderId: string | null
  // [P8-3] Pass current folder object so uploader can inherit defaultDecayRateDays
  currentFolder?: { defaultDecayRateDays: number | null } | null
  // [P12-4] Ref so parent can programmatically trigger file picker (keyboard shortcut U)
  uploadTriggerRef?: React.MutableRefObject<(() => void) | null>
}

interface UploadState {
  id: string
  file: File
  status: "uploading" | "done" | "error"
  progress: number
  error?: string
}

// [P5-1] Valid decay rate options exposed to Pro users in the upload form.
// Free and Starter users are locked to their plan default — this selector
// is hidden for them and the server enforces the plan rate regardless.
const DECAY_RATE_OPTIONS = [
  { label: "7 days",  value: 7  },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
  { label: "1 year",  value: 365 },
] as const

export function FileUploader({ onUploadComplete, plan, currentFolderId, currentFolder, uploadTriggerRef }: Props) {
  const [uploads, setUploads]         = useState<UploadState[]>([])
  const [isTouch, setIsTouch]         = useState(false)
  const isPro = plan === "pro"

  // [P5-1] Custom decay rate — only sent when user is Pro.
  // [P8-3] Initialise from folder's defaultDecayRateDays if set; else plan default (90d).
  const folderDefault = isPro && currentFolder?.defaultDecayRateDays
    ? currentFolder.defaultDecayRateDays
    : 90
  const [decayRateDays, setDecayRateDays] = useState<number>(folderDefault)
  const [showDecayPicker, setShowDecayPicker] = useState(false)

  // [P8-3] When folder changes, update the decay rate picker to the folder's default (Pro).
  useEffect(() => {
    if (!isPro) return
    const folderRate = currentFolder?.defaultDecayRateDays
    if (folderRate && DECAY_RATE_OPTIONS.some((o) => o.value === folderRate)) {
      setDecayRateDays(folderRate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder?.defaultDecayRateDays, isPro])

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches)
  }, [])

  function patchUpload(id: string, patch: Partial<UploadState>) {
    setUploads((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u))
  }

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  const uploadFile = useCallback(async (file: File) => {
    const id = `${file.name}-${file.size}-${Date.now()}`
    setUploads((prev) => [...prev, { id, file, status: "uploading", progress: 0 }])

    try {
      const body: Record<string, unknown> = {
        filename:    file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes:   file.size,
        ...(currentFolderId != null && { folderId: currentFolderId }),
      }

      // [P5-1] Pro users can pass a custom decayRateDays at upload time.
      // The server validates the plan and enforces allowed values.
      if (isPro) {
        body.decayRateDays = decayRateDays
      }

      const metaRes = await fetch("/api/files", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })

      if (!metaRes.ok) {
        const err = await metaRes.json()
        // [P12-3] 507 = storage quota exceeded — surface a clear actionable message
        if (metaRes.status === 507) {
          throw new Error("Storage full — upgrade your plan or delete files to make room.")
        }
        throw new Error(err.error ?? "Upload failed")
      }

      const { uploadUrl, file: newFile } = await metaRes.json()

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            patchUpload(id, { progress: Math.round((e.loaded / e.total) * 100) })
          }
        }
        xhr.onload  = () => xhr.status < 400 ? resolve() : reject(new Error(`Storage upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error("Network error during upload"))
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.send(file)
      })

      // [P6-3] Confirm the upload so the file appears in the dashboard.
      // Must be awaited — fetchAll() filters to uploadConfirmed=true, so calling
      // onUploadComplete() before this resolves causes the file to not appear.
      try {
        await fetch(`/api/files/${newFile.id}/confirm`, { method: "POST" })
      } catch {
        // If confirm fails, cron cleanup will prune the ghost record.
      }

      patchUpload(id, { status: "done", progress: 100 })
      onUploadComplete()
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => !(u.id === id && u.status === "done")))
      }, 4000)
    } catch (err) {
      patchUpload(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUploadComplete, currentFolderId, isPro, decayRateDays])

  const retryUpload = useCallback((u: UploadState) => {
    dismissUpload(u.id)
    uploadFile(u.file)
  }, [uploadFile])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(uploadFile)
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    maxSize: 5 * 1024 * 1024 * 1024,
  })

  // [P12-4] Expose open() so the dashboard's keyboard shortcut (U) can trigger it
  useEffect(() => {
    if (uploadTriggerRef) uploadTriggerRef.current = open
    return () => { if (uploadTriggerRef) uploadTriggerRef.current = null }
  }, [open, uploadTriggerRef])

  const activeUploads  = uploads.filter((u) => u.status === "uploading")
  const finishedCount  = uploads.filter((u) => u.status === "done" || u.status === "error").length
  const selectedOption = DECAY_RATE_OPTIONS.find((o) => o.value === decayRateDays)

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className="rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all"
        style={{
          background:  isDragActive ? "var(--accent-dim)" : "var(--bg-card)",
          border:      isDragActive ? "2px dashed var(--accent)" : "2px dashed var(--border)",
        }}
      >
        <input {...getInputProps()} />
        {isTouch ? (
          <FingerprintIcon
            className="w-7 h-7 mx-auto mb-2"
            style={{ color: isDragActive ? "var(--accent)" : "var(--text-dim)" }}
          />
        ) : (
          <UploadCloudIcon
            className="w-7 h-7 mx-auto mb-2"
            style={{ color: isDragActive ? "var(--accent)" : "var(--text-dim)" }}
          />
        )}
        <p className="text-sm font-medium">
          {isDragActive
            ? "Drop to upload"
            : isTouch
            ? "Tap to browse files"
            : "Drop files here or click to browse"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Images, video, audio, PDF, documents — any file up to 5 GB
        </p>
      </div>

      {/* [P5-1] Pro decay rate picker — shown only for Pro users, below the drop zone */}
      {isPro && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{
            background: "var(--bg-card)",
            border:     "1px solid var(--border)",
          }}
        >
          <ClockIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Decay rate for new uploads
            {currentFolder?.defaultDecayRateDays && (
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                (folder default)
              </span>
            )}
            <HelpTooltip
              content="How many days before this file is deleted if not accessed. Pro users can set a custom rate per file or inherit from the folder default."
              guideAnchor="pro"
              position="top"
            />
          </span>
          <div className="relative ml-auto">
            <button
              onClick={() => setShowDecayPicker((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: "var(--bg-elevated)",
                border:     "1px solid var(--border)",
                color:      "var(--accent)",
              }}
            >
              {selectedOption?.label ?? "90 days"}
              <ChevronDownIcon className="w-3 h-3" />
            </button>

            {showDecayPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDecayPicker(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden py-1"
                  style={{
                    minWidth:   160,
                    background: "var(--bg-elevated)",
                    border:     "1px solid var(--border)",
                    boxShadow:  "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  {DECAY_RATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setDecayRateDays(opt.value); setShowDecayPicker(false) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-left hover:bg-[var(--bg-hover)] transition-colors"
                      style={{
                        color: decayRateDays === opt.value ? "var(--accent)" : "var(--text)",
                        fontWeight: decayRateDays === opt.value ? 600 : 400,
                      }}
                    >
                      {opt.label}
                      {decayRateDays === opt.value && (
                        <span style={{ color: "var(--accent)" }}>✓</span>
                      )}
                    </button>
                  ))}
                  <div
                    className="px-4 py-2 text-xs"
                    style={{
                      color:        "var(--text-dim)",
                      borderTop:    "1px solid var(--border-subtle)",
                      marginTop:    4,
                    }}
                  >
                    File auto-deletes after this period of inactivity
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2" role="status" aria-live="polite" aria-label="Upload progress">
          {activeUploads.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Uploading {activeUploads.length} file{activeUploads.length !== 1 ? "s" : ""}…
              </p>
              {finishedCount > 0 && (
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {finishedCount} finished
                </p>
              )}
            </div>
          )}

          {uploads.map((u) => (
            <div
              key={u.id}
              className="rounded-lg px-4 py-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                {u.status === "done" ? (
                  <CheckCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} />
                ) : u.status === "error" ? (
                  <XCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                ) : (
                  <FileIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm truncate">{u.file.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {formatBytes(u.file.size)}
                      </span>
                      {u.status === "uploading" && (
                        <span className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                          {u.progress}%
                        </span>
                      )}
                      {u.status === "error" && (
                        <button
                          onClick={() => retryUpload(u)}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
                          style={{ background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        >
                          <RefreshCwIcon className="w-3 h-3" /> Retry
                        </button>
                      )}
                      {(u.status === "done" || u.status === "error") && (
                        <button onClick={() => dismissUpload(u.id)} className="action-btn p-0.5 rounded">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {u.status === "uploading" && (
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{ width: `${u.progress}%`, background: "var(--accent)" }}
                      />
                    </div>
                  )}

                  {u.status === "error" && u.error && (
                    <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{u.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}