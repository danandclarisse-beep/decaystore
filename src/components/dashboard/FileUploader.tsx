"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  UploadCloudIcon, CheckCircleIcon, XCircleIcon,
  XIcon, RefreshCwIcon, FileIcon,
} from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface Props {
  onUploadComplete: () => void
  plan: string
  currentFolderId: string | null
}

interface UploadState {
  id: string
  file: File
  status: "uploading" | "done" | "error"
  progress: number  // 0–100
  error?: string
}

// Accepted MIME types / extensions to show in the drop zone hint
const ACCEPT_HINT = "Images, video, audio, PDF, documents, archives — any file up to 5 GB"

export function FileUploader({ onUploadComplete, plan, currentFolderId }: Props) {
  const [uploads, setUploads] = useState<UploadState[]>([])

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
      // Step 1: get presigned URL
      const metaRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId: currentFolderId,
        }),
      })

      if (!metaRes.ok) {
        const err = await metaRes.json()
        throw new Error(err.error ?? "Upload failed")
      }

      const { uploadUrl } = await metaRes.json()

      // Step 2: PUT to R2 via XHR for progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            patchUpload(id, { progress: Math.round((e.loaded / e.total) * 100) })
          }
        }
        xhr.onload = () => {
          if (xhr.status < 400) resolve()
          else reject(new Error(`Storage upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Network error during upload"))
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.send(file)
      })

      patchUpload(id, { status: "done", progress: 100 })
      onUploadComplete()
      // Auto-dismiss successes after 4s; user can also dismiss manually
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => !(u.id === id && u.status === "done")))
      }, 4000)
    } catch (err) {
      patchUpload(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      })
    }
  }, [onUploadComplete, currentFolderId])

  const retryUpload = useCallback((u: UploadState) => {
    dismissUpload(u.id)
    uploadFile(u.file)
  }, [uploadFile])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(uploadFile)
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 5 * 1024 * 1024 * 1024,
  })

  const activeUploads  = uploads.filter((u) => u.status === "uploading")
  const finishedCount  = uploads.filter((u) => u.status === "done" || u.status === "error").length

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className="rounded-xl p-8 text-center cursor-pointer transition-all"
        style={{
          background: isDragActive ? "var(--accent-dim)" : "var(--bg-card)",
          border: isDragActive ? "2px dashed var(--accent)" : "2px dashed var(--border)",
        }}
      >
        <input {...getInputProps()} />
        <UploadCloudIcon
          className="w-7 h-7 mx-auto mb-2"
          style={{ color: isDragActive ? "var(--accent)" : "var(--text-dim)" }}
        />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop to upload" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {ACCEPT_HINT}
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {/* Aggregate header when multiple in flight */}
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
                      <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {formatBytes(u.file.size)}
                      </span>
                      {u.status === "uploading" && (
                        <span className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                          {u.progress}%
                        </span>
                      )}
                      {/* Retry button for errors */}
                      {u.status === "error" && (
                        <button
                          onClick={() => retryUpload(u)}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
                          style={{ background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          title="Retry upload"
                        >
                          <RefreshCwIcon className="w-3 h-3" /> Retry
                        </button>
                      )}
                      {/* Manual dismiss for done/error */}
                      {(u.status === "done" || u.status === "error") && (
                        <button
                          onClick={() => dismissUpload(u.id)}
                          className="action-btn p-0.5 rounded"
                          title="Dismiss"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar (uploading) */}
                  {u.status === "uploading" && (
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{ width: `${u.progress}%`, background: "var(--accent)" }}
                      />
                    </div>
                  )}

                  {/* Error message */}
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