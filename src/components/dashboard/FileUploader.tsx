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
  status: "pending" | "uploading" | "done" | "error"
  progress: number
  error?: string
}

export function FileUploader({ onUploadComplete, plan }: Props) {
  const [uploads, setUploads] = useState<UploadState[]>([])

  const uploadFile = useCallback(async (file: File) => {
    const id = file.name + file.size

    setUploads((prev) => [
      ...prev,
      { file, status: "uploading", progress: 0 },
    ])

    try {
      // Step 1: Request presigned URL from our API
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

      const { presignedUrl } = await metaRes.json()

      // Step 2: Upload directly to R2 using the presigned URL.
      // Do NOT add extra headers here — the presigned URL already encodes
      // the expected headers. Adding Content-Type separately causes a
      // SignatureDoesNotMatch error if it wasn't included in the signed headers.
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
      })

      if (!uploadRes.ok) throw new Error("R2 upload failed")

      setUploads((prev) =>
        prev.map((u) =>
          u.file.name === file.name && u.file.size === file.size
            ? { ...u, status: "done", progress: 100 }
            : u
        )
      )

      onUploadComplete()

      // Clear done uploads after 3 seconds
      setTimeout(() => {
        setUploads((prev) =>
          prev.filter(
            (u) => !(u.file.name === file.name && u.file.size === file.size && u.status === "done")
          )
        )
      }, 3000)
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.file.name === file.name && u.file.size === file.size
            ? { ...u, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : u
        )
      )
    }
  }, [onUploadComplete])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach(uploadFile)
    },
    [uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-gray-900 bg-gray-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloudIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium">
          {isDragActive ? "Drop to upload" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Any file type · Up to 5 GB per file
        </p>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-4 py-3"
            >
              {u.status === "done" ? (
                <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
              ) : u.status === "error" ? (
                <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{u.file.name}</p>
                {u.status === "error" && (
                  <p className="text-xs text-red-500">{u.error}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(u.file.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}