"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloudIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface Props {
  onUploadComplete: () => void
  plan: string
}

interface UploadState {
  file: File
  status: "uploading" | "done" | "error"
  error?: string
}

export function FileUploader({ onUploadComplete, plan }: Props) {
  const [uploads, setUploads] = useState<UploadState[]>([])

  const updateUpload = useCallback((file: File, patch: Partial<UploadState>) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.file.name === file.name && u.file.size === file.size ? { ...u, ...patch } : u
      )
    )
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    setUploads((prev) => [...prev, { file, status: "uploading" }])

    try {
      // Step 1: Get presigned URL (metadata only — no size limit)
      const metaRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      })

      if (!metaRes.ok) {
        const err = await metaRes.json()
        throw new Error(err.error ?? "Upload failed")
      }

      const { uploadUrl } = await metaRes.json()

      // Step 2: PUT directly to R2 (browser → Cloudflare, not Vercel)
      const r2Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })

      if (!r2Res.ok) throw new Error(`Storage upload failed (${r2Res.status})`)

      updateUpload(file, { status: "done" })
      onUploadComplete()

      setTimeout(() => {
        setUploads((prev) =>
          prev.filter(
            (u) => !(u.file.name === file.name && u.file.size === file.size && u.status === "done")
          )
        )
      }, 3000)
    } catch (err) {
      updateUpload(file, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      })
    }
  }, [onUploadComplete, updateUpload])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(uploadFile)
  }, [uploadFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 5 * 1024 * 1024 * 1024,
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className="rounded-xl p-10 text-center cursor-pointer transition-all"
        style={{
          background: isDragActive ? "var(--accent-dim)" : "var(--bg-card)",
          border: isDragActive
            ? "2px dashed var(--accent)"
            : "2px dashed var(--border)",
        }}
        onMouseEnter={e => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = "var(--text-dim)"
            e.currentTarget.style.background = "var(--bg-hover)"
          }
        }}
        onMouseLeave={e => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.background = "var(--bg-card)"
          }
        }}
      >
        <input {...getInputProps()} />
        <UploadCloudIcon
          className="w-8 h-8 mx-auto mb-3"
          style={{ color: isDragActive ? "var(--accent)" : "var(--text-dim)" }}
        />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop to upload" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Any file type · Up to 5 GB per file
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              {u.status === "done" ? (
                <CheckCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} />
              ) : u.status === "error" ? (
                <XCircleIcon className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
              ) : (
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent shrink-0 animate-spin"
                  style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{u.file.name}</p>
                {u.status === "error" && (
                  <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>{u.error}</p>
                )}
              </div>
              <span
                className="text-xs shrink-0"
                style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
              >
                {formatBytes(u.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}