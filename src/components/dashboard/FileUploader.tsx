"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  UploadCloudIcon, CheckCircleIcon, XCircleIcon,
  XIcon, RefreshCwIcon, FileIcon,
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
  // [P18] Called when user needs to upgrade (trial expired upload block)
  onUpgrade?: () => void
}

interface UploadState {
  id: string
  file: File
  status: "uploading" | "done" | "error"
  progress: number
  error?: string
  errorType?: "storage_full" | "trial_expired" | "generic"
}

// [P5-1] Valid decay rate options exposed to Pro users in the upload form.
const DECAY_RATE_OPTIONS = [
  { label: "7 days",   value: 7   },
  { label: "14 days",  value: 14  },
  { label: "30 days",  value: 30  },
  { label: "60 days",  value: 60  },
  { label: "90 days",  value: 90  },
  { label: "180 days", value: 180 },
  { label: "1 year",   value: 365 },
] as const

export function FileUploader({ onUploadComplete, plan, currentFolderId, currentFolder, uploadTriggerRef, onUpgrade }: Props) {
  const [uploads, setUploads]         = useState<UploadState[]>([])
  const isPro = plan === "pro" || plan === "trial"

  // [P5-1] Custom decay rate — only sent when user is Pro or on trial.
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

      // [P5-1] Pro/trial users can pass a custom decayRateDays at upload time.
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

        // [P18] 507 can mean storage full OR trial expired — differentiate by error message
        if (metaRes.status === 507) {
          if (err.error?.includes("trial")) {
            patchUpload(id, {
              status:    "error",
              errorType: "trial_expired",
              error:     "Your trial has ended. Subscribe to continue uploading.",
            })
            return
          }
          patchUpload(id, {
            status:    "error",
            errorType: "storage_full",
            error:     "Storage full — upgrade your plan or delete files to make room.",
          })
          return
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
        status:    "error",
        errorType: "generic",
        error:     err instanceof Error ? err.message : "Upload failed",
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
    <>
      {/* [P17-4] Hidden dropzone root — covers the whole page while dragging. */}
      <div {...getRootProps()} style={{ display: "contents" }}>
        <input {...getInputProps()} />
      </div>

      {/* [P17-4] Full-window drag-over overlay — only visible while dragging */}
      {isDragActive && (
        <div
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center gap-4 pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            border: "3px dashed var(--accent)",
          }}
        >
          <UploadCloudIcon className="w-16 h-16" style={{ color: "var(--accent)" }} />
          <p className="text-2xl font-bold" style={{ color: "var(--accent)", fontFamily: "Syne, sans-serif" }}>
            Drop to upload
          </p>
          {currentFolderId && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Files will be added to the current folder
            </p>
          )}
        </div>
      )}

      {/* [P5-1] Pro/trial decay rate picker */}
      {isPro && (
        <div className="flex items-center gap-2">
          <ClockIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
          <span className="text-xs font-medium hidden sm:block" style={{ color: "var(--text-muted)" }}>
            Decay
            {currentFolder?.defaultDecayRateDays && (
              <span className="ml-1" style={{ color: "var(--text-dim)" }}>(folder)</span>
            )}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowDecayPicker((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
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
                      {decayRateDays === opt.value && <span style={{ color: "var(--accent)" }}>✓</span>}
                    </button>
                  ))}
                  <div className="px-4 py-2 text-xs" style={{ color: "var(--text-dim)", borderTop: "1px solid var(--border-subtle)", marginTop: 4 }}>
                    Auto-deletes after this period of inactivity
                  </div>
                </div>
              </>
            )}
          </div>
          <HelpTooltip
            content="How many days before this file is deleted if not accessed. Pro users can set a custom rate per file."
            guideAnchor="pro"
            position="bottom"
          />
        </div>
      )}

      {/* Upload progress — fixed bottom toast stack */}
      {uploads.length > 0 && (
        <div
          className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-3rem)]"
          role="status"
          aria-live="polite"
          aria-label="Upload progress"
        >
          {activeUploads.length > 1 && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <span>Uploading {activeUploads.length} files…</span>
              {finishedCount > 0 && <span style={{ color: "var(--text-dim)" }}>{finishedCount} done</span>}
            </div>
          )}
          {uploads.map((u) => (
            <div
              key={u.id}
              className="rounded-xl px-3 py-2.5"
              style={{
                background: "var(--bg-elevated)",
                border: `1px solid ${u.status === "error" ? "rgba(239,68,68,0.3)" : u.status === "done" ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div className="flex items-center gap-2.5">
                {u.status === "done" ? (
                  <CheckCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} />
                ) : u.status === "error" ? (
                  <XCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                ) : (
                  <FileIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{u.file.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {u.status === "uploading" ? `${u.progress}%` : formatBytes(u.file.size)}
                      </span>
                      {u.status === "error" && u.errorType !== "trial_expired" && (
                        <button
                          onClick={() => retryUpload(u)}
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        >
                          <RefreshCwIcon className="w-2.5 h-2.5" /> Retry
                        </button>
                      )}
                      {(u.status === "done" || u.status === "error") && (
                        <button onClick={() => dismissUpload(u.id)} className="action-btn p-0.5 rounded">
                          <XIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {u.status === "uploading" && (
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                      <div className="h-full rounded-full transition-all duration-150" style={{ width: `${u.progress}%`, background: "var(--accent)" }} />
                    </div>
                  )}
                  {u.status === "error" && u.error && (
                    <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>{u.error}</p>
                  )}
                  {/* [P18] Trial expired CTA inline in toast */}
                  {u.status === "error" && u.errorType === "trial_expired" && onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: "#ef4444", color: "#fff" }}
                    >
                      Upgrade — $15/mo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}