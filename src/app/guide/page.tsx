import Link from "next/link"
import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"
import { GuideNav } from "@/components/shared/GuideNav"
import { auth } from "@clerk/nextjs/server"
import { getUserByClerkId } from "@/lib/auth-helpers"
import type { PlanKey } from "@/lib/plans"

// ── Plan badge component ─────────────────────────────────────────────────────
function PlanBadge({ plans }: { plans: string[] }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    "All":     { bg: "rgba(245,166,35,0.12)",  text: "#f5a623" },
    "Starter": { bg: "rgba(52,211,153,0.12)",  text: "#34d399" },
    "Pro":     { bg: "rgba(147,197,253,0.15)", text: "#60a5fa" },
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {plans.map((p) => {
        const c = colorMap[p] ?? { bg: "var(--bg-hover)", text: "var(--text-muted)" }
        return (
          <span
            key={p}
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: c.bg, color: c.text, fontFamily: "DM Mono, monospace" }}
          >
            {p}
          </span>
        )
      })}
    </div>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ id, title, plans }: { id: string; title: string; plans: string[] }) {
  return (
    <div id={id} className="flex items-start justify-between gap-4 mb-8 scroll-mt-28">
      <h2
        className="text-2xl font-bold"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {title}
      </h2>
      <PlanBadge plans={plans} />
    </div>
  )
}

// ── Feature block ─────────────────────────────────────────────────────────────
function FeatureBlock({ title, plans, children }: { title: string; plans: string[]; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <PlanBadge plans={plans} />
      </div>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  )
}

// ── Inline code ──────────────────────────────────────────────────────────────
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded text-xs"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--accent)",
        fontFamily: "DM Mono, monospace",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </code>
  )
}

// ── Decay colour scale visual ────────────────────────────────────────────────
function DecayScale() {
  const stops = [
    { label: "Fresh",    pct: 12,  color: "#34d399", range: "0–25%" },
    { label: "Aging",    pct: 37,  color: "#84cc16", range: "25–50%" },
    { label: "Stale",    pct: 62,  color: "#fbbf24", range: "50–75%" },
    { label: "Critical", pct: 82,  color: "#f97316", range: "75–90%" },
    { label: "Expiring", pct: 96,  color: "#ef4444", range: "90–100%" },
  ]
  return (
    <div
      className="rounded-xl p-5 my-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-medium mb-4" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
        decay_scale.visual
      </p>
      {/* Bar */}
      <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: "var(--bg-hover)" }}>
        <div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(to right, #34d399, #84cc16, #fbbf24, #f97316, #ef4444)",
            width: "100%",
          }}
        />
      </div>
      {/* Labels */}
      <div className="grid grid-cols-5 gap-2">
        {stops.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="w-2 h-2 rounded-full mx-auto mb-1"
              style={{ background: s.color }}
            />
            <p className="text-xs font-semibold" style={{ color: s.color, fontFamily: "DM Mono, monospace", fontSize: 10 }}>
              {s.label}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)", fontSize: 10 }}>
              {s.range}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Email warning timeline visual ───────────────────────────────────────────
function EmailTimeline({ decayDays }: { decayDays: number }) {
  const events = [
    { pct: 0,   label: "Uploaded",        color: "var(--decay-fresh)" },
    { pct: 50,  label: "Warning email",   color: "#fbbf24" },
    { pct: 90,  label: "Critical email",  color: "#f97316" },
    { pct: 100, label: "Deleted",         color: "#ef4444" },
  ]
  return (
    <div
      className="rounded-xl p-5 my-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-medium mb-4" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
        email_timeline.{decayDays}d
      </p>
      <div className="relative">
        {/* Track */}
        <div className="h-1 rounded-full mb-6" style={{ background: "var(--bg-hover)" }}>
          <div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(to right, #34d399, #ef4444)", width: "100%" }}
          />
        </div>
        {/* Markers */}
        <div className="relative h-8">
          {events.map((e) => (
            <div
              key={e.label}
              className="absolute -top-7 flex flex-col items-center"
              style={{ left: `${e.pct}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-2 h-2 rounded-full mb-1" style={{ background: e.color }} />
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: e.color, fontFamily: "DM Mono, monospace", fontSize: 10 }}
              >
                {e.pct === 0 ? "Day 0" : `Day ${Math.round(decayDays * e.pct / 100)}`}
              </span>
            </div>
          ))}
        </div>
        {/* Labels below */}
        <div className="relative h-6">
          {events.map((e) => (
            <div
              key={e.label + "_label"}
              className="absolute flex flex-col items-center"
              style={{ left: `${e.pct}%`, transform: "translateX(-50%)" }}
            >
              <span
                className="text-xs text-center"
                style={{ color: "var(--text-dim)", fontSize: 10, maxWidth: 60 }}
              >
                {e.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default async function GuidePage() {
  const { userId: clerkId } = await auth()
  let userPlan: PlanKey | null = null
  if (clerkId) {
    const user = await getUserByClerkId(clerkId)
    userPlan = (user?.plan ?? "free") as PlanKey
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav userPlan={userPlan} />

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Page header */}
        <div className="mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}
          >
            Documentation
          </p>
          <h1
            className="text-4xl font-bold mb-4"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            User Guide
          </h1>
          <p className="text-base max-w-xl" style={{ color: "var(--text-muted)" }}>
            Everything you need to know about DecayStore — from uploading your first file
            to building automations with the API.
          </p>
        </div>

        {/* Two-column layout: sticky nav + content */}
        <div className="flex gap-16 items-start">
          <GuideNav />

          <div className="flex-1 min-w-0 space-y-24">

            {/* ── Section 1: Getting started ────────────────────────────── */}
            <section>
              <SectionHeading id="getting-started" title="Getting started" plans={["All"]} />

              <FeatureBlock title="How decay works" plans={["All"]}>
                <p>
                  Every file you upload has a <strong>decay clock</strong>. The clock starts ticking
                  from the moment you last accessed the file. If you never open it again, its decay
                  score rises from 0 to 100% over your plan&apos;s decay window — then the file is
                  permanently deleted from both our database and Cloudflare R2.
                </p>
                <p>
                  Accessing a file — opening the preview, downloading it, or clicking Renew —
                  resets the clock back to 0%. The file gets a full new decay window.
                </p>
                <DecayScale />
              </FeatureBlock>

              <FeatureBlock title="Decay windows by plan" plans={["All"]}>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {[
                    { plan: "Free",    days: 14,  color: "var(--text-muted)" },
                    { plan: "Starter", days: 30,  color: "#34d399" },
                    { plan: "Pro",     days: 90,  color: "#60a5fa" },
                  ].map((p) => (
                    <div
                      key={p.plan}
                      className="rounded-lg p-4 text-center"
                      style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                    >
                      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{p.plan}</p>
                      <p className="text-2xl font-bold" style={{ color: p.color, fontFamily: "DM Mono, monospace" }}>{p.days}</p>
                      <p className="text-xs" style={{ color: "var(--text-dim)" }}>days</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3">
                  Pro users can also set custom decay rates per file (7 d to 365 d) — see the
                  Pro features section below.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Email warnings" plans={["All"]}>
                <p>
                  DecayStore sends you automatic email alerts before a file disappears.
                  You receive warnings at three points in a file&apos;s lifecycle:
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2">
                    <span style={{ color: "#fbbf24" }}>→</span>
                    <span><strong>50% decayed</strong> — first warning, plenty of time to act.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "#f97316" }}>→</span>
                    <span><strong>90% decayed</strong> — final warning, the file is close to deletion.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "#ef4444" }}>→</span>
                    <span><strong>Deletion</strong> — a confirmation that the file has been removed.</span>
                  </li>
                </ul>
                <EmailTimeline decayDays={30} />
                <p>
                  Each warning email includes a one-click Renew link that resets the file&apos;s
                  clock without requiring you to log in. Starter and Pro users can disable digest
                  emails in account settings.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Uploading your first file" plans={["All"]}>
                <ol className="list-decimal list-inside space-y-2 mt-1">
                  <li>Go to your <Link href="/dashboard" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>dashboard</Link>.</li>
                  <li>Click <strong>Upload files</strong> in the top-right, or drag files directly into the file grid.</li>
                  <li>Files are sent directly from your browser to Cloudflare R2 via a presigned URL — your data never touches our server.</li>
                  <li>Once uploaded, the file appears in your grid with a green <Code>Fresh</Code> badge and a full decay clock.</li>
                </ol>
                <p className="mt-2">
                  Supported types include images, documents, audio, video, and archives. Files up to
                  5 GB are accepted. Executable files (<Code>.exe</Code>, <Code>.sh</Code>, etc.)
                  are not permitted.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Renewing a file" plans={["All"]}>
                <p>
                  To reset a file&apos;s decay clock, open its details or click the <strong>Renew</strong> button
                  (the circular arrow icon on the file card). The score returns to 0% and the full
                  decay window restarts immediately.
                </p>
                <p>
                  You can also renew files in bulk — select multiple files using the checkboxes
                  and click <strong>Renew all</strong> in the action bar that appears at the bottom of the screen.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Reading the storage bar" plans={["All"]}>
                <p>
                  The storage bar in the left sidebar shows how much of your plan&apos;s quota you&apos;ve used.
                  The bar turns <span style={{ color: "#f97316" }}>orange</span> at 70% and <span style={{ color: "#ef4444" }}>red</span> at 90%.
                  At 100%, new uploads are rejected until you free space by deleting files or upgrading.
                </p>
                <p>
                  Your current file count is shown alongside the storage usage. Free users are limited
                  to 100 files; Starter to 500; Pro is unlimited.
                </p>
              </FeatureBlock>
            </section>

            {/* ── Section 2: Organising ──────────────────────────────────── */}
            <section>
              <SectionHeading id="organising" title="Organising your files" plans={["All"]} />

              <FeatureBlock title="Folders" plans={["All"]}>
                <p>
                  Create folders from the sidebar using the <strong>+</strong> button next to
                  &ldquo;Folders&rdquo;. Click a folder to browse its contents. The breadcrumb bar
                  at the top of the file grid always shows your current location.
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Rename</strong> — click the <Code>⋯</Code> menu on the folder card.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Delete</strong> — files inside are moved to root, sub-folders become top-level folders.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Move files</strong> — drag a file card onto a folder, or use the Move option in the <Code>⋯</Code> menu.</span></li>
                </ul>
              </FeatureBlock>

              <FeatureBlock title="Search and filters" plans={["All"]}>
                <p>
                  The search bar at the top of the file grid filters results instantly by filename
                  — no page reload. Below the search bar, filter pills let you narrow by file type:
                  Images, Documents, Video, Audio, or Archives.
                </p>
                <p>
                  The <strong>Sort</strong> dropdown lets you order by decay score (most urgent first),
                  name A–Z, file size, or upload date. The filtered count is shown in the grid header.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Bulk actions" plans={["All"]}>
                <p>
                  Hover any file card to reveal the checkbox in the top-left corner. Select one or more
                  files and a sticky action bar appears at the bottom of the screen with three options:
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Renew all</strong> — resets the decay clock on every selected file simultaneously.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Move to folder</strong> — opens a folder picker; all selected files are moved in parallel.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Delete all</strong> — requires inline confirmation; files and their R2 objects are removed immediately.</span></li>
                </ul>
              </FeatureBlock>

              <FeatureBlock title="File tags" plans={["All"]}>
                <p>
                  Add tags to any file to categorise it beyond folders. Open the file&apos;s details
                  modal (click the file name), type a tag in the tag input, and press Enter. Tags are
                  sanitised to lowercase letters, numbers, hyphens, and underscores.
                </p>
                <p>
                  When any file in your current view has tags, a tag filter row appears below the
                  search bar. Clicking a tag filters the grid to files sharing that tag — no API call,
                  instant.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Drag and drop" plans={["All"]}>
                <p>
                  Drag any file card over a folder card — the folder highlights with an amber border
                  and a subtle scale-up to confirm it&apos;s a valid drop target. A hint pill appears
                  at the bottom of the screen: &ldquo;Drop onto a folder to move.&rdquo; Release to move
                  the file. You can also drag files from your desktop directly into the file grid to
                  upload them.
                </p>
              </FeatureBlock>
            </section>

            {/* ── Section 3: Starter features ──────────────────────────────── */}
            <section>
              <SectionHeading id="starter" title="Starter features" plans={["Starter", "Pro"]} />

              <FeatureBlock title="Activity log" plans={["Starter", "Pro"]}>
                <p>
                  The activity log records every decay event, warning email, renewal, upload,
                  deletion, and version update for your account. Open it from the dashboard header
                  using the <strong>Activity</strong> toggle in the breadcrumb bar.
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Events are sorted newest first, paginated 50 per page.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Click any row to filter the log to that specific file.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Pro users can export the full log as a CSV using the <strong>Export CSV</strong> button.</span></li>
                </ul>
                <p className="mt-2">
                  On desktop the log opens as an inline panel on the right. On mobile it opens as a
                  full-height drawer from the right edge.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Weekly decay digest email" plans={["Starter", "Pro"]}>
                <p>
                  Every Monday at 09:00 UTC, DecayStore sends you a summary of any files that are
                  50% or more decayed. The digest includes the filename, current decay percentage,
                  days remaining, and a one-click Renew link for each file — no login required.
                </p>
                <p>
                  To disable the digest, go to{" "}
                  <Link href="/account" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>
                    Account settings
                  </Link>{" "}
                  and turn off <strong>Weekly decay digest</strong>.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Priority support" plans={["Starter", "Pro"]}>
                <p>
                  Click the <strong>Support</strong> button in the dashboard header (the life ring icon)
                  to open a pre-filled support email addressed to our team. Your plan and account email
                  are included automatically.
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "#34d399" }}>→</span><span>Starter: 48-hour response time.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "#60a5fa" }}>→</span><span>Pro: 24-hour response time.</span></li>
                </ul>
              </FeatureBlock>
            </section>

            {/* ── Section 4: Pro features ──────────────────────────────────── */}
            <section>
              <SectionHeading id="pro" title="Pro features" plans={["Pro"]} />

              <FeatureBlock title="Custom decay rates per file" plans={["Pro"]}>
                <p>
                  When uploading a file, a <strong>Decay rate</strong> selector appears in the upload
                  modal (Pro users only). Choose from 7 days, 14, 30, 60, 90, 180, or 365 days.
                </p>
                <p>
                  To change the rate on an existing file, open the <Code>⋯</Code> menu on the file card
                  and choose <strong>Set decay rate</strong>. The new rate takes effect immediately —
                  the remaining time is recalculated against the file&apos;s last access time.
                </p>
                <p>
                  The server always enforces the custom rate regardless of plan — Free and Starter
                  users cannot set custom rates even via the API.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Folder-level decay defaults" plans={["Pro"]}>
                <p>
                  Set a default decay rate on any folder by opening the folder&apos;s <Code>⋯</Code> menu
                  and choosing <strong>Decay settings</strong>. Files uploaded into that folder
                  automatically inherit the folder&apos;s default rate, and the upload modal shows a
                  &ldquo;(folder default)&rdquo; hint next to the selector.
                </p>
              </FeatureBlock>

              <FeatureBlock title="Public share links" plans={["Pro"]}>
                <p>
                  Toggle <strong>Make public</strong> in a file card&apos;s <Code>⋯</Code> menu to generate
                  a shareable link at <Code>/share/[fileId]</Code>. Anyone with the link can view file
                  info and download the file — no login required.
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Each public access resets the file&apos;s decay clock — active shared files never expire.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>The share page shows the download count and the file&apos;s decay health strip.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Public access is rate-limited to 10 requests per minute per IP.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Toggle off at any time — the link immediately stops working.</span></li>
                </ul>
              </FeatureBlock>

              <FeatureBlock title="Usage analytics" plans={["Pro"]}>
                <p>
                  Click the <strong>Analytics</strong> toggle in the breadcrumb bar to open the analytics
                  panel. It shows:
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Storage trend</strong> — a 30-day area chart of your storage usage over time, capped to your plan quota.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Decay distribution</strong> — a stacked bar showing how many files sit in each decay bucket right now.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><strong>Top renewed files</strong> — the five files you&apos;ve renewed most recently.</span></li>
                </ul>
                <p className="mt-2">
                  The storage snapshot is written daily at 03:00 UTC by an automated cron.
                  The panel is accurate to the previous day&apos;s snapshot.
                </p>
              </FeatureBlock>

              <FeatureBlock title="API key management" plans={["Pro"]}>
                <p>
                  Generate API keys from the <strong>API Keys</strong> panel in your dashboard.
                  Keys use the prefix <Code>dsk_</Code> and are shown in full exactly once —
                  only a SHA-256 hash is stored. Copy the key immediately and store it securely
                  (e.g. in a password manager or CI secret).
                </p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Up to 10 active keys per account.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Keys never expire — revoke from the panel when no longer needed.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span>Last-used timestamp is updated on every authenticated request.</span></li>
                </ul>
              </FeatureBlock>

              <FeatureBlock title="Using the REST API" plans={["Pro"]}>
                <p>
                  Authenticate API requests with your key in the <Code>Authorization</Code> header:
                </p>
                <div
                  className="rounded-lg px-4 py-3 my-3 text-xs overflow-x-auto"
                  style={{ background: "var(--bg-elevated)", fontFamily: "DM Mono, monospace", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Authorization: Bearer dsk_your_key_here
                </div>
                <p>Key endpoints:</p>
                <ul className="list-none space-y-1 mt-2">
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><Code>GET /api/files</Code> — list your files with decay scores.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><Code>GET /api/files/[id]</Code> — get a single file, including a presigned download URL.</span></li>
                  <li className="flex items-start gap-2"><span style={{ color: "var(--accent)" }}>→</span><span><Code>DELETE /api/files/[id]</Code> — delete a file and its R2 object.</span></li>
                </ul>
                <p className="mt-3">
                  Full reference with request/response examples:{" "}
                  <Link href="/api-docs" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>
                    API documentation →
                  </Link>
                </p>
              </FeatureBlock>
            </section>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
