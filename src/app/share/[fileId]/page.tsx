import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { files, users } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { getPresignedDownloadUrl } from "@/lib/r2"
import { headers } from "next/headers"
import { formatBytes, getMimeTypeIcon } from "@/lib/utils"
import { getDecayLabel, getDecayColor, calculateDecayScore, getTimeUntilDeletion } from "@/lib/decay-utils"
import Link from "next/link"

// Rate-limit: 10 req/min per IP (in-memory, best-effort on single instance)
const ipHits = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const win = ipHits.get(ip)
  if (!win || now >= win.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  win.count++
  return win.count <= 10
}

type Props = { params: { fileId: string } }

export default async function SharePage({ params }: Props) {
  // ── Rate limit ─────────────────────────────────────────────
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!checkRateLimit(ip)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">⏳</p>
          <p className="text-sm font-semibold mb-1">Rate limit exceeded</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Too many requests. Please wait a minute and try again.</p>
        </div>
      </div>
    )
  }

  // ── Fetch file ─────────────────────────────────────────────
  const file = await db.query.files.findFirst({
    where: and(
      eq(files.id, params.fileId),
      eq(files.isPublic, true),
    ),
  })

  if (!file || file.status === "deleted") notFound()

  // ── Reset decay clock + increment public download count ────
  await db
    .update(files)
    .set({
      lastAccessedAt: new Date(),
      publicDownloadCount: sql`public_download_count + 1`,
    })
    .where(eq(files.id, file.id))

  // ── Generate presigned download URL ────────────────────────
  let downloadUrl: string | null = null
  try {
    downloadUrl = await getPresignedDownloadUrl(file.r2Key, 3600)
  } catch {
    // If R2 is unreachable, we still render the page — just disable download
  }

  const liveScore = calculateDecayScore(new Date(file.lastAccessedAt), file.decayRateDays)
  const decayColor = getDecayColor(liveScore)
  const decayLabel = getDecayLabel(liveScore)
  const timeLeft   = getTimeUntilDeletion(new Date(file.lastAccessedAt), file.decayRateDays)
  const icon       = getMimeTypeIcon(file.mimeType)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8"
      style={{ background: "var(--bg)" }}
    >
      {/* Card */}
      <div
        className="w-full max-w-md rounded-2xl p-6 sm:p-8 flex flex-col gap-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Branding */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs font-bold tracking-widest" style={{ color: "var(--accent)", fontFamily: "Syne, sans-serif", letterSpacing: "0.15em" }}>
            DECAYSTORE
          </Link>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(245,166,35,0.12)", color: "var(--accent)" }}
          >
            Shared file
          </span>
        </div>

        {/* File header */}
        <div className="flex items-start gap-4">
          <span className="text-4xl leading-none shrink-0 mt-1">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold leading-snug break-all">{file.originalFilename}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
              {formatBytes(file.sizeBytes)} · {file.mimeType}
            </p>
          </div>
        </div>

        {/* Decay strip */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "var(--bg-elevated)", border: `1px solid ${decayColor}33` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: decayColor, fontFamily: "DM Mono, monospace" }}>
              {decayLabel} — {(liveScore * 100).toFixed(1)}% decayed
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
              {timeLeft} left
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${liveScore * 100}%`, background: decayColor, transition: "width 0.4s" }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
            ↩ Accessing this file reset its decay timer.
          </p>
        </div>

        {/* File metadata */}
        <div className="space-y-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Downloads", value: String((file.publicDownloadCount ?? 0) + 1) },
            { label: "Uploaded", value: new Date(file.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
            { label: "Version", value: `v${file.currentVersionNumber}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
              <span className="text-xs font-mono" style={{ color: "var(--text)", fontFamily: "DM Mono, monospace" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Download button */}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download={file.originalFilename}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            ↓ Download {file.originalFilename}
          </a>
        ) : (
          <div
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Download temporarily unavailable
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "var(--text-dim)" }}>
          Shared via{" "}
          <Link href="/" className="underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>
            DecayStore
          </Link>
          {" — "}files that self-destruct if forgotten.
        </p>
      </div>
    </div>
  )
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props) {
  const file = await db.query.files.findFirst({
    where: and(eq(files.id, params.fileId), eq(files.isPublic, true)),
  })
  if (!file) return { title: "File not found — DecayStore" }
  return {
    title: `${file.originalFilename} — DecayStore`,
    description: `Shared file: ${file.originalFilename} (${formatBytes(file.sizeBytes)}). Shared via DecayStore — files that self-destruct if forgotten.`,
  }
}