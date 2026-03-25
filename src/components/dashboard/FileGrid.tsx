"use client"

import { useState } from "react"
import { RefreshCwIcon, Trash2Icon, DownloadIcon, ClockIcon } from "lucide-react"
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
      <div
        className="rounded-xl py-20 text-center"
        style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
      >
        <p className="text-4xl mb-4">📁</p>
        <p className="text-sm font-medium mb-1">No files yet</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Drop a file above to get started.
        </p>
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
        onRefresh()
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

  const sorted = [...files].sort((a, b) => b.decayScore - a.decayScore)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {files.length} file{files.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onRefresh}
          className="text-xs flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--bg-card)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <RefreshCwIcon className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((file) => {
          const decayColor = getDecayColor(file.decayScore)
          const decayLabel = getDecayLabel(file.decayScore)
          const daysLeft = getDaysUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)
          const isCritical = file.decayScore >= 0.75
          const isExpiring = file.decayScore >= 0.9

          return (
            <div
              key={file.id}
              className="rounded-xl p-5 flex flex-col gap-4 transition-all"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${isCritical ? (isExpiring ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.25)") : "var(--border)"}`,
                boxShadow: isExpiring ? "0 0 20px rgba(239,68,68,0.06)" : "none",
              }}
            >
              {/* File header */}
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{getMimeTypeIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.originalFilename}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                    {formatBytes(file.sizeBytes)} · {formatRelativeTime(file.uploadedAt)}
                  </p>
                </div>
              </div>

              {/* Decay bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: decayColor,
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {decayLabel}
                  </span>
                  <span
                    className="text-xs flex items-center gap-1"
                    style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
                  >
                    <ClockIcon className="w-3 h-3" />
                    {daysLeft}d left
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div
                    className={cn("h-full rounded-full transition-all", isCritical && "animate-pulse-slow")}
                    style={{ width: `${file.decayScore * 100}%`, background: decayColor }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex items-center gap-2 pt-1"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <ActionBtn
                  onClick={() => handleDownload(file.id, file.originalFilename)}
                  disabled={!!actionLoading}
                  title="Download (resets decay clock)"
                  color="var(--text-muted)"
                  hoverColor="var(--text)"
                >
                  <DownloadIcon className="w-3.5 h-3.5" /> Download
                </ActionBtn>

                <ActionBtn
                  onClick={() => handleRenew(file.id)}
                  disabled={!!actionLoading}
                  title="Reset decay clock"
                  color="#34d399"
                  hoverColor="#6ee7b7"
                >
                  <RefreshCwIcon className="w-3.5 h-3.5" /> Renew
                </ActionBtn>

                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={!!actionLoading}
                  title="Delete permanently"
                  className="flex items-center justify-center p-1.5 rounded-md transition-all disabled:opacity-50"
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = "#ef4444"
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = "var(--text-dim)"
                    e.currentTarget.style.background = "transparent"
                  }}
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

function ActionBtn({
  onClick, disabled, title, color, hoverColor, children
}: {
  onClick: () => void
  disabled: boolean
  title: string
  color: string
  hoverColor: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all disabled:opacity-50"
      style={{ color }}
      onMouseEnter={e => {
        e.currentTarget.style.color = hoverColor
        e.currentTarget.style.background = "var(--bg-hover)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = color
        e.currentTarget.style.background = "transparent"
      }}
    >
      {children}
    </button>
  )
}