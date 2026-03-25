import { formatBytes } from "@/lib/utils"
import Link from "next/link"

interface Props {
  used: number
  limit: number
  plan: string
}

export function StorageBar({ used, limit, plan }: Props) {
  const pct = Math.min((used / limit) * 100, 100)
  const barColor =
    pct > 90 ? "#ef4444" :
    pct > 70 ? "#f97316" :
    "var(--accent)"

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">Storage</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
            {formatBytes(used)} / {formatBytes(limit)}
          </p>
        </div>
        {plan === "free" && (
          <Link
            href="/pricing"
            className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              background: "var(--bg-hover)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)" }}
          >
            Upgrade →
          </Link>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
        {pct.toFixed(1)}% used
      </p>
    </div>
  )
}