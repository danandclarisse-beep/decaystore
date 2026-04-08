import Link from "next/link"
import { PLANS, PLAN_STORAGE_LIMITS } from "@/lib/plans"
import type { PlanKey } from "@/lib/plans"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  firstName:        string | null
  plan:             PlanKey
  storageUsedBytes: number
  storageLimit:     number
  totalFiles:       number
  needsAttention:   number
  nextPlan:         PlanKey | null
}

export function PersonalisedHero({
  firstName,
  plan,
  storageUsedBytes,
  storageLimit,
  totalFiles,
  needsAttention,
  nextPlan,
}: Props) {
  const usedPct    = storageLimit > 0 ? Math.min((storageUsedBytes / storageLimit) * 100, 100) : 0
  const planConfig = PLANS[plan]

  const storageBarColor =
    usedPct > 90 ? "#ef4444" :
    usedPct > 70 ? "#f97316" :
    "var(--accent)"

  const greeting = firstName ? `Welcome back, ${firstName}.` : "Welcome back."

  // Health pill
  const healthLabel =
    needsAttention === 0 ? "All clear" :
    needsAttention === 1 ? "1 file needs attention" :
    `${needsAttention} files need attention`

  const healthColor =
    needsAttention === 0 ? "var(--decay-fresh)" :
    needsAttention <= 2  ? "#14b8a6" :
    "#ef4444"

  return (
    <section className="relative overflow-hidden">
      {/* Subtle glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(20,184,166,0.06) 0%, transparent 70%)" }}
      />

      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 relative">
        {/* Plan badge */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            {planConfig.name} plan
          </div>
        </div>

        {/* Greeting */}
        <h1
          className="text-5xl sm:text-6xl font-bold mb-3 text-center"
          style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.03em", lineHeight: 1.05 }}
        >
          {greeting}
        </h1>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          {/* File count */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <span style={{ color: "var(--text-dim)" }}>Files</span>
            <span className="font-semibold" style={{ fontFamily: "DM Mono, monospace" }}>{totalFiles}</span>
          </div>

          {/* Storage */}
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: 200 }}
          >
            <span style={{ color: "var(--text-dim)" }}>Storage</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)", minWidth: 80 }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${usedPct}%`, background: storageBarColor }}
              />
            </div>
            <span className="font-semibold shrink-0" style={{ fontFamily: "DM Mono, monospace", fontSize: 11 }}>
              {formatBytes(storageUsedBytes)} / {formatBytes(storageLimit)}
            </span>
          </div>

          {/* Health */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--bg-card)", border: `1px solid ${needsAttention > 0 ? healthColor + "44" : "var(--border)"}` }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: healthColor }}
            />
            <span style={{ color: healthColor, fontFamily: "DM Mono, monospace", fontSize: 12 }}>
              {healthLabel}
            </span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="btn-accent px-6 py-3 rounded-xl text-sm text-center">
            Go to dashboard →
          </Link>
          {nextPlan && (
            <Link
              href="/pricing"
              className="btn-outline px-6 py-3 rounded-xl text-sm text-center"
            >
              Upgrade to {PLANS[nextPlan].name}
            </Link>
          )}
          <Link href="/guide" className="btn-ghost px-6 py-3 rounded-xl text-sm text-center">
            User guide
          </Link>
        </div>
      </div>
    </section>
  )
}
