import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { Nav } from "@/components/shared/Nav"
import { Footer } from "@/components/shared/Footer"
import { getUserByClerkId } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { files as filesTable } from "@/lib/db/schema"
import { eq, and, ne, desc } from "drizzle-orm"
import { PLANS, PLAN_STORAGE_LIMITS } from "@/lib/plans"
import { calculateDecayScore, getDecayColor, getDecayLabel, getDaysUntilDeletion } from "@/lib/decay-utils"
import type { PlanKey } from "@/lib/plans"
import { PersonalisedHero } from "@/components/home/PersonalisedHero"
import { NudgeStrip } from "@/components/home/NudgeStrip"

// ─── Static decay demo (shown to anonymous visitors or users with no files) ───
const DEMO_FILES = [
  { name: "project-brief.pdf", score: 0.05, label: "Fresh",    color: "#34d399", days: 28 },
  { name: "old-mockups.fig",   score: 0.52, label: "Aging",    color: "#fbbf24", days: 14 },
  { name: "draft-v1.docx",     score: 0.78, label: "Critical", color: "#f97316", days: 6  },
  { name: "2021-receipts.zip", score: 0.96, label: "Expiring", color: "#ef4444", days: 1  },
] as const

// ─── How it works steps ────────────────────────────────────
const HOW_IT_WORKS = [
  { step: "01", title: "Upload your files",    body: "Drop any file. It starts fresh with a full decay clock — no urgency yet." },
  { step: "02", title: "Decay starts ticking", body: "Every day you don't access a file, its decay score rises. Email warnings before it's gone." },
  { step: "03", title: "Renew or lose it",     body: "Open a file to reset its clock. Ignore it and it disappears. Your intent, made permanent." },
] as const

// ─── Feature highlights ────────────────────────────────────
const FEATURES = [
  { icon: "⚡", title: "Direct-to-R2 uploads",  body: "Files go browser → Cloudflare R2 directly. No server bottleneck. Supports files up to 5 GB." },
  { icon: "📧", title: "Email decay warnings",  body: "Get warned at 50%, 90%, and right before deletion. Never lose a file by surprise." },
  { icon: "🔒", title: "Secure by default",     body: "All files are private. Presigned URLs expire in 1 hour. Zero public exposure by default." },
  { icon: "💸", title: "Zero egress cost",      body: "Powered by Cloudflare R2 — no bandwidth fees ever, no matter how many times you download." },
] as const

export default async function HomePage() {
  // ── Server-side auth: fetch signed-in user + top decaying files ──────────
  const { userId: clerkId } = await auth()
  let userData: {
    firstName: string | null
    plan: PlanKey
    storageUsedBytes: number
    storageLimit: number
    liveFiles: Array<{ name: string; score: number; label: string; color: string; days: number }>
    totalFiles: number
    needsAttention: number
  } | null = null

  if (clerkId) {
    try {
      const user = await getUserByClerkId(clerkId)
      if (user) {
        const plan = (user.plan ?? "free") as PlanKey
        const storageLimit = PLAN_STORAGE_LIMITS[plan]

        // Fetch top 4 most-decayed confirmed, non-deleted files
        const topFiles = await db
          .select()
          .from(filesTable)
          .where(
            and(
              eq(filesTable.userId, user.id),
              eq(filesTable.uploadConfirmed, true),
              ne(filesTable.status, "deleted")
            )
          )
          .orderBy(desc(filesTable.decayScore))
          .limit(4)

        // Fetch total count & at-risk count
        const allActiveFiles = await db
          .select({ decayScore: filesTable.decayScore, decayRateDays: filesTable.decayRateDays, lastAccessedAt: filesTable.lastAccessedAt })
          .from(filesTable)
          .where(
            and(
              eq(filesTable.userId, user.id),
              eq(filesTable.uploadConfirmed, true),
              ne(filesTable.status, "deleted")
            )
          )

        const needsAttention = allActiveFiles.filter(f => f.decayScore >= 0.5).length

        const liveFiles = topFiles.map(f => {
          const score = calculateDecayScore(new Date(f.lastAccessedAt), f.decayRateDays)
          return {
            name:  f.originalFilename,
            score,
            label: getDecayLabel(score),
            color: getDecayColor(score),
            days:  getDaysUntilDeletion(new Date(f.lastAccessedAt), f.decayRateDays),
          }
        })

        // Get first name from Clerk (available via publicMetadata or email prefix)
        const { currentUser } = await import("@clerk/nextjs/server")
        const clerkUser = await currentUser()
        const firstName = clerkUser?.firstName ?? null

        userData = {
          firstName,
          plan,
          storageUsedBytes: user.storageUsedBytes,
          storageLimit,
          liveFiles,
          totalFiles: allActiveFiles.length,
          needsAttention,
        }
      }
    } catch {
      // If DB call fails, gracefully fall back to anonymous view
    }
  }

  // ── Decide which decay preview to render ─────────────────
  const showLivePreview = userData && userData.liveFiles.length > 0
  const previewFiles = showLivePreview
    ? userData!.liveFiles
    : DEMO_FILES.map(f => ({ ...f }))

  // ── Upgrade path logic ────────────────────────────────────
  const nextPlanMap: Record<PlanKey, PlanKey | null> = {
    free: "starter",
    starter: "pro",
    pro: null,
  }
  const nextPlan = userData ? nextPlanMap[userData.plan] : null

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav userPlan={userData?.plan ?? null} />

      {/* ── P11-7: Upgrade nudge strip (signed-in Free/Starter only) ─────── */}
      {userData && nextPlan && (
        <NudgeStrip plan={userData.plan} nextPlan={nextPlan} />
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      {userData ? (
        // P11-1: Personalised hero for authenticated users
        <PersonalisedHero
          firstName={userData.firstName}
          plan={userData.plan}
          storageUsedBytes={userData.storageUsedBytes}
          storageLimit={userData.storageLimit}
          totalFiles={userData.totalFiles}
          needsAttention={userData.needsAttention}
          nextPlan={nextPlan}
        />
      ) : (
        // Anonymous marketing hero
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(245,166,35,0.08) 0%, transparent 70%)" }}
          />
          <div className="max-w-5xl mx-auto px-6 pt-28 pb-24 text-center relative">
            <div
              className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid rgba(245,166,35,0.2)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: "var(--accent)" }} />
              Files that forget themselves
            </div>

            <h1
              className="text-6xl sm:text-7xl font-bold mb-6"
              style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.03em", lineHeight: 1.05 }}
            >
              Storage with
              <br />
              <span style={{ color: "var(--accent)" }}>a memory.</span>
            </h1>

            <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Files you ignore slowly decay and delete themselves.
              Files you care about, you renew. No hoarding. No clutter.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/sign-up" className="btn-accent px-6 py-3 rounded-xl text-sm">
                Start for free →
              </Link>
              <Link href="/pricing" className="btn-outline px-6 py-3 rounded-xl text-sm">
                See pricing
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── P11-2: Decay preview (live for signed-in, demo for anonymous) ── */}
      <section className="max-w-2xl mx-auto px-6 py-4 mb-16">
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-medium" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
              {showLivePreview ? "your_files.live" : "decay_preview.demo"}
            </p>
            <div className="flex items-center gap-3">
              {showLivePreview && (
                <Link
                  href="/dashboard"
                  className="text-xs"
                  style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace" }}
                >
                  View all →
                </Link>
              )}
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444", opacity: 0.6 }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24", opacity: 0.6 }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399", opacity: 0.6 }} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {previewFiles.map((file) => (
              <div key={file.name} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs ml-4 shrink-0" style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                      {file.days}d
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(file.score * 100)}%`, background: file.color }}
                    />
                  </div>
                </div>
                <span
                  className="text-xs font-semibold w-14 text-right shrink-0"
                  style={{ color: file.color, fontFamily: "DM Mono, monospace" }}
                >
                  {file.label}
                </span>
              </div>
            ))}
          </div>

          {!showLivePreview && (
            <p className="text-xs mt-4 text-center" style={{ color: "var(--text-dim)" }}>
              Example — your files will appear here after you sign in.
            </p>
          )}
        </div>
      </section>

      {/* ── Divider before marketing content ─────────────────────────────── */}
      {userData && (
        <div className="max-w-5xl mx-auto px-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
            <p className="text-xs font-medium uppercase tracking-widest shrink-0" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
              About DecayStore
            </p>
            <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
          </div>
        </div>
      )}

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }} className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: "var(--text-dim)", fontFamily: "DM Mono, monospace" }}>
            How it works
          </p>
          <h2 className="text-3xl font-bold text-center mb-16">Three steps. No hoarding.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl p-6"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <p className="text-3xl font-bold mb-4" style={{ color: "var(--accent)", fontFamily: "DM Mono, monospace", opacity: 0.5 }}>
                  {item.step}
                </p>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature highlights ────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6 flex gap-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── P11-6: Plan-aware bottom CTA ─────────────────────────────────── */}
      <section className="py-24" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          {userData ? (
            // Signed-in: show upgrade CTA or pro satisfaction message
            nextPlan ? (
              <>
                <h2 className="text-4xl font-bold mb-4">
                  Unlock {PLANS[nextPlan].name}
                </h2>
                <p className="text-base mb-6" style={{ color: "var(--text-muted)" }}>
                  {PLANS[nextPlan].description} · ${PLANS[nextPlan].price}/mo
                </p>
                <ul className="text-sm mb-8 space-y-2 text-left inline-block">
                  {PLANS[nextPlan].features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <span style={{ color: "var(--accent)" }}>✓</span>
                      <span style={{ color: "var(--text-muted)" }}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/pricing" className="btn-accent inline-block px-8 py-3.5 rounded-xl text-sm">
                    Upgrade to {PLANS[nextPlan].name} →
                  </Link>
                  <Link href="/dashboard" className="btn-outline inline-block px-8 py-3.5 rounded-xl text-sm">
                    Go to dashboard
                  </Link>
                </div>
              </>
            ) : (
              // Pro user — no upgrade needed
              <>
                <h2 className="text-4xl font-bold mb-4">You're on Pro.</h2>
                <p className="text-base mb-8" style={{ color: "var(--text-muted)" }}>
                  You have access to every feature DecayStore offers.
                </p>
                <Link href="/dashboard" className="btn-accent inline-block px-8 py-3.5 rounded-xl text-sm">
                  Go to dashboard →
                </Link>
              </>
            )
          ) : (
            // Anonymous visitor
            <>
              <h2 className="text-4xl font-bold mb-4">Ready to declutter?</h2>
              <p className="text-base mb-8" style={{ color: "var(--text-muted)" }}>
                Free plan includes 1 GB and 100 files. No credit card required.
              </p>
              <Link href="/auth/sign-up" className="btn-accent inline-block px-8 py-3.5 rounded-xl text-sm">
                Start for free — no credit card
              </Link>
              <p className="text-xs mt-4" style={{ color: "var(--text-dim)" }}>
                By signing up you agree to our{" "}
                <Link href="/legal/terms" className="underline underline-offset-2" style={{ color: "var(--text-muted)" }}>Terms of Service</Link>
                {" "}and{" "}
                <Link href="/legal/privacy" className="underline underline-offset-2" style={{ color: "var(--text-muted)" }}>Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
