export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { decayEvents, files } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getOrCreateUser } from "@/lib/auth-helpers"
import { z } from "zod"

const PAGE_SIZE = 50

const querySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  fileId: z.string().uuid().optional(),
})

// ─── GET /api/activity — list decay events for current user ───
// Returns paginated decay events (newest first) for Starter + Pro.
// Free users receive 403. Optional ?fileId= filter narrows to one file.
// Pro users may additionally request ?export=csv for a CSV download.
export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getOrCreateUser()

    if (user.plan === "free") {
      return NextResponse.json(
        { error: "Activity log is available on Starter and Pro plans" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)

    const parsed = querySchema.safeParse({
      page:   searchParams.get("page") ?? 1,
      fileId: searchParams.get("fileId") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
    }
    const { page, fileId } = parsed.data

    // Verify the requested fileId belongs to this user (IDOR guard)
    if (fileId) {
      const file = await db.query.files.findFirst({
        where: and(eq(files.id, fileId), eq(files.userId, user.id)),
      })
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const offset = (page - 1) * PAGE_SIZE

    const whereClause = fileId
      ? and(eq(decayEvents.userId, user.id), eq(decayEvents.fileId, fileId))
      : eq(decayEvents.userId, user.id)

    // Fetch one extra row to detect if a next page exists
    const rows = await db
      .select({
        id:                decayEvents.id,
        fileId:            decayEvents.fileId,
        eventType:         decayEvents.eventType,
        decayScoreAtEvent: decayEvents.decayScoreAtEvent,
        createdAt:         decayEvents.createdAt,
        filename:          files.originalFilename,
      })
      .from(decayEvents)
      .leftJoin(files, eq(decayEvents.fileId, files.id))
      .where(whereClause)
      .orderBy(desc(decayEvents.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset(offset)

    const hasNextPage = rows.length > PAGE_SIZE
    const events = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows

    // ─── CSV export (Pro only) ─────────────────────────────────
    const exportCsv = searchParams.get("export") === "csv"
    if (exportCsv) {
      if (user.plan !== "pro") {
        return NextResponse.json({ error: "CSV export is available on Pro plan" }, { status: 403 })
      }
      const header = "id,fileId,filename,eventType,decayScoreAtEvent,createdAt\n"
      const csvRows = events
        .map((e) =>
          [
            e.id,
            e.fileId,
            `"${(e.filename ?? "").replace(/"/g, '""')}"`,
            e.eventType,
            e.decayScoreAtEvent.toFixed(4),
            e.createdAt.toISOString(),
          ].join(",")
        )
        .join("\n")
      return new Response(header + csvRows, {
        headers: {
          "Content-Type":        "text/csv",
          "Content-Disposition": `attachment; filename="activity-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json({
      events,
      pagination: {
        page,
        pageSize:    PAGE_SIZE,
        hasNextPage,
      },
    })
  } catch (err) {
    console.error("[GET /api/activity]", err)
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 })
  }
}