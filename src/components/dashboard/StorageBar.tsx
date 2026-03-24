import { formatBytes } from "@/lib/utils"
import Link from "next/link"

interface Props {
  used: number
  limit: number
  plan: string
}

export function StorageBar({ used, limit, plan }: Props) {
  const pct = Math.min((used / limit) * 100, 100)
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f97316" : "#22c55e"

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Storage</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatBytes(used)} of {formatBytes(limit)} used
          </p>
        </div>
        {plan === "free" && (
          <Link
            href="/pricing"
            className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-md transition-colors"
          >
            Upgrade for more →
          </Link>
        )}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{pct.toFixed(1)}% used</p>
    </div>
  )
}
