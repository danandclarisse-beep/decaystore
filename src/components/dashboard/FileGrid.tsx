"use client"

import { useState } from "react"
import {
  RefreshCwIcon,
  Trash2Icon,
  DownloadIcon,
  ClockIcon,
} from "lucide-react"
import { formatBytes, formatRelativeTime, getMimeTypeIcon, cn } from "@/lib/utils"
import { getDecayColor, getDecayLabel, getDaysUntilDeletion } from "@/lib/decay-utils"
import type { File } from "@/lib/db/schema"

interface Props {
  files: File[]
  onRefresh: () => void
}

export function FileGrid({ files, onRefresh }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  if (files.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-3xl mb-3">📁</p>
        <p className="text-gray-500 text-sm">No files yet. Upload something.</p>
      </div>
    )
  }

  async function handleRenew(fileId: string) {
    setActionLoading(fileId + "-renew")
    try {
      await fetch(`/api/files/${fileId}`, { method: "PATCH" })
      onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDownload(fileId: string, filename: string) {
    setActionLoading(fileId + "-download")
    try {
      const res = await fetch(`/api/files/${fileId}`)
      const data = await res.json()
      if (data.downloadUrl) {
        const a = document.createElement("a")
        a.href = data.downloadUrl
        a.download = filename
        a.click()
        onRefresh() // accessing resets decay clock
      }
    } finally {
      setActionLoading(null)
    }
  }

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

  // Sort by decay score descending (most critical first)
  const sorted = [...files].sort((a, b) => b.decayScore - a.decayScore)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        <button
          onClick={onRefresh}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCwIcon className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((file) => {
          const decayColor = getDecayColor(file.decayScore)
          const decayLabel = getDecayLabel(file.decayScore)
          const daysLeft = getDaysUntilDeletion(
            new Date(file.lastAccessedAt),
            file.decayRateDays
          )
          const isCritical = file.decayScore >= 0.75

          return (
            <div
              key={file.id}
              className={cn(
                "bg-white rounded-xl border p-5 flex flex-col gap-4 transition-all",
                isCritical ? "border-orange-200" : "border-gray-200"
              )}
            >
              {/* File header */}
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">
                  {getMimeTypeIcon(file.mimeType)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.originalFilename}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatBytes(file.sizeBytes)} · {formatRelativeTime(file.uploadedAt)}
                  </p>
                </div>
              </div>

              {/* Decay bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: decayColor }}>
                    {decayLabel}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {daysLeft}d left
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isCritical && "animate-pulse"
                    )}
                    style={{
                      width: `${file.decayScore * 100}%`,
                      backgroundColor: decayColor,
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => handleDownload(file.id, file.originalFilename)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 py-1.5 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Download (also resets decay clock)"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Download
                </button>

                <button
                  onClick={() => handleRenew(file.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-green-600 hover:text-green-800 py-1.5 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50"
                  title="Reset decay clock to zero"
                >
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                  Renew
                </button>

                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center p-1.5 text-gray-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete permanently"
                >
                  <Trash2Icon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}