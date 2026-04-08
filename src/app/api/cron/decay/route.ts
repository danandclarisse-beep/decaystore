import { NextResponse } from "next/server"
import { runDecayCycle } from "@/lib/decay"

// This endpoint is called nightly by Vercel Cron (configured in vercel.json)
// Protected by CRON_SECRET to prevent unauthorized calls
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[CRON] Starting decay cycle...")
    const stats = await runDecayCycle()
    console.log("[CRON] Decay cycle complete:", stats)

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats,
      pages: stats.pages,
    })
  } catch (err) {
    console.error("[CRON] Decay cycle failed:", err)
    return NextResponse.json(
      { error: "Decay cycle failed", message: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    )
  }
}