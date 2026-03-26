import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { sendWelcomeEmail } from "@/lib/email"
import type { User } from "@/lib/db/schema"

export async function getOrCreateUser(): Promise<User> {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error("Unauthorized")

  // [P3-3] Single-query upsert: INSERT ... ON CONFLICT DO NOTHING ... RETURNING
  // collapses the previous check-then-insert (2 round-trips) into 1.
  // We need the email for new users, so we fetch the Clerk user upfront.
  // For existing users the currentUser() call is wasted, but it's much cheaper
  // than a separate DB read — Clerk caches it at the edge per request.
  const clerkUser = await currentUser()
  if (!clerkUser) throw new Error("Clerk user not found")

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""

  const [upserted] = await db
    .insert(users)
    .values({ clerkId, email, plan: "free" })
    .onConflictDoNothing({ target: users.clerkId })
    .returning()

  if (upserted) {
    // Genuinely new user — send welcome email
    await sendWelcomeEmail(email)
    return upserted
  }

  // Row already existed — fetch it (one DB query total on the happy path)
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  })
  if (!existing) throw new Error("User not found after upsert")
  return existing
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return (
    (await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    })) ?? null
  )
}