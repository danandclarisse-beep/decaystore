"use client"

// [P8-1] Activity log panel — shows decayEvents for the current user.
// Starter + Pro only. Pro users get a CSV export button.

import { useEffect, useState, useCallback } from "react"
import {
  HistoryIcon, DownloadIcon, ChevronLeftIcon,
  ChevronRightIcon, FilterIcon, XIcon,
  UploadIcon, RefreshCwIcon, AlertTriangleIcon,
  Trash2Icon, ShieldAlertIcon, InfoIcon,
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

interface ActivityEvent {
  id:                string
  fileId:            string
  filename:          string | null
  eventType:         string
  decayScoreAtEvent: number
  createdAt:         string
}

interface Pagination {
  page:        number
  pageSize:    number
  hasNextPage: boolean
}

interface Props {
  plan:   string
  isOpen: boolean
  onClose: () => void
}

// ─── Event type metadata ─────────────────────────────────────
const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  upload:   { label: "Uploaded",         icon: UploadIcon,        color: "#60a5fa" },
  renewed:  { label: "Renewed",          icon: RefreshCwIcon,     color: "#34d399" },
  warned:   { label: "Warning sent",     icon: AlertTriangleIcon, color: "#fbbf24" },
  critical: { label: "Critical warning", icon: ShieldAlertIcon,   color: "#f97316" },
  deleted:  { label: "Auto-deleted",     icon: Trash2Icon,        color: "#f87171" },
  pruned:   { label: "Ghost pruned",     icon: XIcon,             color: "#9ca3af" },
}

function getEventMeta(eventType: string) {
  return EVENT_META[eventType] ?? { label: eventType, icon: InfoIcon, color: "var(--text-dim)" }
}

function decayColor(score: number) {
  if (score < 0.25) return "#22c55e"
  if (score < 0.5)  return "#84cc16"
  if (score < 0.75) return "#eab308"
  if (score < 0.9)  return "#f97316"
  return "#ef4444"
}

export function ActivityPanel({ plan, isOpen, onClose }: Props) {
  const isPro     = plan === "pro"
  const isEligible = plan === "starter" || plan === "pro"

  const [events, setEvents]         = useState<ActivityEvent[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, hasNextPage: false })
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [filterFileId, setFilterFileId] = useState<string | null>(null)
  const [filterLabel, setFilterLabel]   = useState<string | null>(null)
  const [exporting, setExporting]       = useState(false)

  const fetchEvents = useCallback(async (page: number, fileId?: string | null) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (fileId) params.set("fileId", fileId)
      const res = await fetch(`/api/activity?${params}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to load activity")
        return
      }
      const data = await res.json()
      setEvents(data.events ?? [])
      setPagination(data.pagination)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && isEligible) {
      fetchEvents(1, filterFileId)
    }
  }, [isOpen, isEligible, fetchEvents, filterFileId])

  function filterByFile(fileId: string, filename: string | null) {
    setFilterFileId(fileId)
    setFilterLabel(filename ?? fileId.slice(0, 8))
    fetchEvents(1, fileId)
  }

  function clearFilter() {
    setFilterFileId(null)
    setFilterLabel(null)
    fetchEvents(1, null)
  }

  async function exportCsv() {
    if (!isPro) return
    setExporting(true)
    try {
      const params = new URLSearchParams({ export: "csv" })
      if (filterFileId) params.set("fileId", filterFileId)
      const res = await fetch(`/api/activity?${params}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = `activity-${Date.now()}.csv`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 z-40 lg:hidden bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col lg:relative lg:inset-auto lg:z-auto"
        style={{
          width: "min(480px, 100vw)",
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <p className="font-semibold text-sm" style={{ fontFamily: "Syne, sans-serif" }}>
              Activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPro && (
              <button
                onClick={exportCsv}
                disabled={exporting || loading || events.length === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: "var(--bg-card)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-muted)",
                }}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                {exporting ? "Exporting…" : "Export CSV"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File filter strip */}
        {filterLabel && (
          <div
            className="flex items-center gap-2 px-5 py-2.5 shrink-0"
            style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <FilterIcon className="w-3 h-3 shrink-0" style={{ color: "var(--accent)" }} />
            <p className="text-xs flex-1 truncate" style={{ color: "var(--accent)" }}>
              Filtered: <span className="font-semibold">{filterLabel}</span>
            </p>
            <button
              onClick={clearFilter}
              className="text-xs px-2 py-0.5 rounded-md"
              style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!isEligible ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
              <HistoryIcon className="w-8 h-8 mb-3" style={{ color: "var(--text-dim)" }} />
              <p className="text-sm font-semibold mb-1">Activity log</p>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                Available on Starter and Pro plans.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
              <button
                onClick={() => fetchEvents(pagination.page, filterFileId)}
                className="mt-3 text-xs px-4 py-2 rounded-lg"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                Retry
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-20 text-center">
              <HistoryIcon className="w-8 h-8 mb-3" style={{ color: "var(--text-dim)" }} />
              <p className="text-sm font-medium mb-1">No activity yet</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Events appear here as you upload, renew, or delete files.
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {events.map((event) => {
                const meta = getEventMeta(event.eventType)
                const Icon = meta.icon
                return (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${meta.color}18` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {event.filename ?? <span style={{ color: "var(--text-dim)" }}>Deleted file</span>}
                        </p>
                        <span className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>
                          {formatRelativeTime(new Date(event.createdAt))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                          ·
                        </span>
                        <span
                          className="text-xs font-mono"
                          style={{ color: decayColor(event.decayScoreAtEvent) }}
                        >
                          {Math.round(event.decayScoreAtEvent * 100)}% decay
                        </span>
                        {event.filename && (
                          <>
                            <span className="text-xs" style={{ color: "var(--text-dim)" }}>·</span>
                            <button
                              onClick={() => filterByFile(event.fileId, event.filename)}
                              className="text-xs transition-colors hover:underline"
                              style={{ color: "var(--text-dim)" }}
                            >
                              Filter
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Pagination footer */}
        {isEligible && !loading && !error && events.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              onClick={() => fetchEvents(pagination.page - 1, filterFileId)}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              Page {pagination.page}
            </span>
            <button
              onClick={() => fetchEvents(pagination.page + 1, filterFileId)}
              disabled={!pagination.hasNextPage}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              Next <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}