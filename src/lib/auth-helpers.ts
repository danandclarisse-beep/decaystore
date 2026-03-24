import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { sendWelcomeEmail } from "@/lib/email"
import { PLAN_DECAY_RATES } from "@/lib/decay"
import type { User } from "@/lib/db/schema"

export async function getOrCreateUser(): Promise<User> {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error("Unauthorized")

  // Check if user exists
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  })
  if (existing) return existing

  // Create new user
  const clerkUser = await currentUser()
  if (!clerkUser) throw new Error("Clerk user not found")

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? ""

  const [newUser] = await db
    .insert(users)
    .values({ clerkId, email, plan: "free" })
    .returning()

  await sendWelcomeEmail(email)
  return newUser
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return (
    (await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    })) ?? null
  )
}
