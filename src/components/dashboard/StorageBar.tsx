import { formatBytes } from "@/lib/utils"
import Link from "next/link"
import { HardDriveIcon } from "lucide-react"
import { HelpTooltip } from "@/components/dashboard/HelpTooltip"

interface Props {
  used: number
  limit: number
  plan: string
  fileCount?: number
  fileLimit?: number
  loading?: boolean
  compact?: boolean
}

export function StorageBar({ used, limit, plan, fileCount, fileLimit, loading = false, compact = false }: Props) {
  // Prevent "0 / 0 GB" flash during initial load
  if (loading) {
    if (compact) {
      return (
        <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="h-1.5 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        </div>
      )
    }
    return (
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        </div>
        <div className="h-1.5 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
      </div>
    )
  }

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const barColor =
    pct > 90 ? "#ef4444" :
    pct > 70 ? "#f97316" :
    "var(--accent)"

  // [P17-6] Compact mode — used in sidebar
  if (compact) {
    return (
      <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <HardDriveIcon className="w-3 h-3" style={{ color: "var(--text-dim)" }} />
            Storage
          </span>
          <span className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <p className="text-xs mt-1.5" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
          {formatBytes(used)} / {formatBytes(limit)}
        </p>
        {pct >= 80 && plan !== "pro" && (
          <Link href="/pricing" className="mt-1.5 text-xs block" style={{ color: barColor, textDecoration: "underline" }}>
            Upgrade →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <HardDriveIcon className="w-3.5 h-3.5" style={{ color: "var(--text-dim)" }} />
              <p className="text-sm font-semibold">Storage</p>
              <HelpTooltip
                content="Tracks total bytes used across all your files. At 100%, new uploads are blocked until you free space or upgrade."
                guideAnchor="getting-started"
                position="bottom"
              />
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
              {formatBytes(used)} / {formatBytes(limit)}
              {fileCount !== undefined && fileLimit !== undefined && (
                <span style={{ color: "var(--text-dim)" }}>
                  {" "}·{" "}{fileCount} / {fileLimit} files
                </span>
              )}
            </p>
          </div>
        </div>
        {plan === "free" && (
          <Link href="/pricing"
            className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "var(--bg-hover)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)" }}>
            Upgrade →
          </Link>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
        {pct.toFixed(1)}% used
      </p>
      {/* [P12-3] Warn at 80% — uploads are blocked at 100% */}
      {pct >= 80 && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed"
          style={{
            background: pct >= 90 ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
            border:     `1px solid ${pct >= 90 ? "rgba(239,68,68,0.25)" : "rgba(249,115,22,0.25)"}`,
            color:      pct >= 90 ? "#ef4444" : "#f97316",
          }}
        >
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>
            You&apos;ve used {pct.toFixed(0)}% of your storage. Uploads will be rejected at 100%.{" "}
            {plan !== "pro" && (
              <Link href="/pricing" style={{ color: "inherit", textDecoration: "underline", fontWeight: 600 }}>
                Upgrade →
              </Link>
            )}
          </span>
        </div>
      )}
    </div>
  )
}