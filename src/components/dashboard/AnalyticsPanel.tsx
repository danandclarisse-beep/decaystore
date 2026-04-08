"use client"

import { useEffect, useState, useCallback } from "react"
import { BarChart2Icon, RefreshCwIcon, TrendingUpIcon, ZapIcon, XIcon, EyeIcon, DownloadIcon, ClockIcon } from "lucide-react"
import { formatBytes, formatRelativeTime } from "@/lib/utils"
import { PLAN_STORAGE_LIMITS } from "@/lib/plans"
import { getDecayColor } from "@/lib/decay-utils"
import type { File } from "@/lib/db/schema"

interface Snapshot {
  date: string
  storageUsedBytes: number
  fileCount: number
}

interface AnalyticsData {
  snapshots: Snapshot[]
  currentStorageBytes: number
  currentFileCount: number
  decayDistribution: {
    fresh: number
    aging: number
    stale: number
    critical: number
    expiring: number
  }
  topRenewed: {
    id: string
    originalFilename: string
    lastAccessedAt: string
    decayScore: number
    sizeBytes: number
  }[]
}

interface Props {
  plan: "free" | "starter" | "pro"
  isOpen: boolean
  onClose: () => void
  /** [P18] All user files — shown as compact list inside the modal */
  files?:      File[]
  onRenew?:    (fileId: string) => void
  onDownload?: (fileId: string, filename: string) => void
  onPreview?:  (file: File) => void
}

const DECAY_COLORS: Record<string, string> = {
  fresh:    "var(--decay-fresh)",
  aging:    "var(--decay-aging)",
  stale:    "var(--decay-stale)",
  critical: "var(--decay-critical)",
  expiring: "var(--decay-expire)",
}

const DECAY_LABELS: Record<string, string> = {
  fresh: "Fresh", aging: "Aging", stale: "Stale", critical: "Critical", expiring: "Expiring",
}

export function AnalyticsPanel({ plan, isOpen, onClose, files = [], onRenew, onDownload, onPreview }: Props) {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // [P10-2] Use the actual user's plan limit, not hardcoded "pro"
  const storageLimit = PLAN_STORAGE_LIMITS[plan]

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/analytics")
      if (!res.ok) throw new Error("Failed to load analytics")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, fetchData])

  if (!isOpen) return null

  // ── SVG Storage Trend chart ───────────────────────────────
  function StorageTrendChart({ snapshots, currentBytes }: { snapshots: Snapshot[]; currentBytes: number }) {
    const W = 340, H = 100, PAD = 8

    // Build points: snapshots oldest→newest + current value as "today"
    const allPoints: { date: string; bytes: number }[] = [
      ...snapshots.slice().reverse().map((s) => ({ date: s.date, bytes: s.storageUsedBytes })),
      { date: new Date().toISOString(), bytes: currentBytes },
    ]

    if (allPoints.length < 2) {
      return (
        <div className="flex items-center justify-center h-[100px] text-xs" style={{ color: "var(--text-dim)" }}>
          Not enough data yet — check back after the first daily snapshot.
        </div>
      )
    }

    const maxBytes = Math.max(...allPoints.map((p) => p.bytes), storageLimit * 0.01)
    const xs = allPoints.map((_, i) => PAD + (i / (allPoints.length - 1)) * (W - PAD * 2))
    const ys = allPoints.map((p) => PAD + (1 - p.bytes / maxBytes) * (H - PAD * 2))

    const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")
    const fill = `${line} L${xs[xs.length - 1].toFixed(1)},${H - PAD} L${xs[0].toFixed(1)},${H - PAD} Z`

    // Label first and last date
    const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#sg)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots at first and last */}
        <circle cx={xs[0]} cy={ys[0]} r="3" fill="var(--accent)" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill="var(--accent)" />
        {/* Date labels */}
        <text x={xs[0]} y={H + 2} fontSize="8" fill="var(--text-dim)" textAnchor="start">{fmt(allPoints[0].date)}</text>
        <text x={xs[xs.length - 1]} y={H + 2} fontSize="8" fill="var(--text-dim)" textAnchor="end">Today</text>
        {/* Value labels */}
        <text x={xs[xs.length - 1]} y={ys[ys.length - 1] - 5} fontSize="8" fill="var(--accent)" textAnchor="end">
          {formatBytes(currentBytes)}
        </text>
      </svg>
    )
  }

  // ── Decay distribution bar ────────────────────────────────
  function DecayBar({ dist }: { dist: AnalyticsData["decayDistribution"] }) {
    const total = Object.values(dist).reduce((s, v) => s + v, 0)
    if (total === 0) return (
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>No files yet.</div>
    )
    const keys = ["fresh", "aging", "stale", "critical", "expiring"] as const
    return (
      <div className="space-y-2">
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {keys.map((k) => {
            const pct = (dist[k] / total) * 100
            if (pct === 0) return null
            return (
              <div
                key={k}
                style={{ width: `${pct}%`, background: DECAY_COLORS[k], minWidth: pct > 0 ? 2 : 0 }}
                title={`${DECAY_LABELS[k]}: ${dist[k]} file${dist[k] !== 1 ? "s" : ""}`}
              />
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {keys.map((k) => dist[k] > 0 && (
            <span key={k} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: DECAY_COLORS[k] }} />
              {DECAY_LABELS[k]} <span style={{ color: "var(--text)" }}>{dist[k]}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  const panelContent = (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <BarChart2Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>Analytics</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "DM Mono, monospace" }}
          >
            Pro
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchData}
            disabled={loading}
            className="action-btn p-1.5 rounded-lg disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} className="action-btn p-1.5 rounded-lg">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {error && (
          <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {loading && !data && (
          <div className="space-y-3 animate-pulse">
            {[80, 60, 100, 70].map((w, i) => (
              <div key={i} className="h-3 rounded-full" style={{ width: `${w}%`, background: "var(--bg-hover)" }} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Storage overview */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                Storage
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Used</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ fontFamily: "DM Mono, monospace" }}>
                    {formatBytes(data.currentStorageBytes)}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Files</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ fontFamily: "DM Mono, monospace" }}>
                    {data.currentFileCount}
                  </p>
                </div>
              </div>
              {/* Storage limit bar */}
              <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--bg-hover)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((data.currentStorageBytes / storageLimit) * 100, 100)}%`,
                    background: "var(--accent)",
                    transition: "width 0.4s",
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {formatBytes(storageLimit - data.currentStorageBytes)} remaining of {formatBytes(storageLimit)}
              </p>
            </section>

            {/* 30-day trend */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                <TrendingUpIcon className="w-3 h-3 inline mr-1" />30-day trend
              </p>
              {data.snapshots.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg text-center"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                >
                  <TrendingUpIcon className="w-5 h-5" style={{ color: "var(--text-dim)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>No snapshot data yet</p>
                  <p className="text-xs max-w-[220px]" style={{ color: "var(--text-muted)" }}>
                    Snapshot data builds up over time. Check back after the next daily cron run at 03:00 UTC.
                  </p>
                </div>
              ) : (
                <StorageTrendChart snapshots={data.snapshots} currentBytes={data.currentStorageBytes} />
              )}
            </section>

            {/* Decay distribution */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                Files by decay status
              </p>
              <DecayBar dist={data.decayDistribution} />
            </section>

            {/* Top renewed */}
            {data.topRenewed.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
                  <ZapIcon className="w-3 h-3 inline mr-1" />Most recently renewed
                </p>
                <div className="space-y-1.5">
                  {data.topRenewed.map((f) => {
                    const fullFile = files.find((file) => file.id === f.id)
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg group/row"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{f.originalFilename}</p>
                          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {formatRelativeTime(f.lastAccessedAt)} · {formatBytes(f.sizeBytes)}
                          </p>
                        </div>
                        {/* Quick actions — visible on hover */}
                        {fullFile && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                            {onPreview && (
                              <button onClick={() => onPreview(fullFile)} className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-dim)" }} title="Preview">
                                <EyeIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDownload && (
                              <button onClick={() => onDownload(fullFile.id, fullFile.originalFilename)} className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-dim)" }} title="Download">
                                <DownloadIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onRenew && (
                              <button onClick={() => onRenew(fullFile.id)} className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "#10b981" }} title="Renew">
                                <RefreshCwIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <div
                          className="text-xs font-semibold shrink-0"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            color: f.decayScore < 0.25 ? "var(--decay-fresh)"
                                 : f.decayScore < 0.5  ? "var(--decay-aging)"
                                 : f.decayScore < 0.75 ? "var(--decay-stale)"
                                 : "var(--decay-critical)",
                          }}
                        >
                          {(f.decayScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* [P18] Rendered as flat content inside a modal — no internal fixed positioning */}
      <div className="flex flex-col" style={{ minHeight: 0, flex: 1 }}>
        {panelContent}
      </div>
    </>
  )
}