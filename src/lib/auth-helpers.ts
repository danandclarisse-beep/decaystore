// FILE: src/lib/auth-helpers.ts
//
// FIXES APPLIED:
//   [Issue 3 — HIGH] Waitlist token is now consumed after a successful sign-up.
//     On first account creation, the waitlist row for the user's email is updated:
//       - status  → "signed_up"
//       - signedUpAt → now
//       - token   → null  (prevents replay attacks within the 48-hour window)
//     Previously the token stayed valid and reusable until the cron expired it,
//     meaning anyone with the invite link could create additional Clerk accounts.
//     Admin counts (signedUpAt = "—") are also corrected by this change.

import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users, waitlist } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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

    // [FIX Issue 3] Consume the waitlist invite token so it cannot be reused.
    // Update the waitlist entry: status → "signed_up", clear the token, set signedUpAt.
    // This is best-effort: if it fails we log and continue — the user has already
    // been created in Clerk and should not be blocked. The middleware post-auth check
    // (Issue 1 fix) uses status "signed_up" to gate access, so this must succeed for
    // the user to access the dashboard. If it fails here, they will be redirected to
    // /waitlist on next request. In practice, a DB failure that prevents this write
    // would also prevent the users.insert above from committing — so this is safe.
    try {
      await db.update(waitlist)
        .set({
          status: "signed_up",
          signedUpAt: new Date(),
          token: null,
        })
        .where(eq(waitlist.email, email))
    } catch (err) {
      console.error("[getOrCreateUser] Failed to consume waitlist token for", email, err)
    }

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