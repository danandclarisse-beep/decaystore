import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// ─── GET /api/health ──────────────────────────────────────
// Lightweight health check endpoint for BetterStack uptime monitoring.
// Checks: process is alive, DB is reachable.
// Returns 200 if healthy, 503 if DB is unreachable.
// No auth required — BetterStack pings this without a session.
// Response time target: < 500ms (Neon cold start included).

export async function GET() {
  const start = Date.now()

  try {
    // Minimal DB ping — 1 round-trip, no table scan
    await db.execute(sql`SELECT 1`)

    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        latencyMs: Date.now() - start,
        ts: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          // Don't cache health checks — always fresh
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (err) {
    console.error("[GET /api/health] DB ping failed:", err)

    return NextResponse.json(
      {
        status: "degraded",
        db: "unreachable",
        latencyMs: Date.now() - start,
        ts: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
}