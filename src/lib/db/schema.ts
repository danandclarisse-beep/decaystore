import {
  pgTable,
  text,
  timestamp,
  real,
  bigint,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core"

export const fileStatusEnum = pgEnum("file_status", [
  "active",
  "warned",
  "compressed",
  "critical",
  "deleted",
])

export const planEnum = pgEnum("plan", ["free", "starter", "pro"])

// ─── Users ────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" })
    .notNull()
    .default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Files ────────────────────────────────────────────────
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // R2 object key
  r2Key: text("r2_key").notNull().unique(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  // Decay tracking
  decayScore: real("decay_score").notNull().default(0), // 0.0 → 1.0
  status: fileStatusEnum("status").notNull().default("active"),
  decayRateDays: real("decay_rate_days").notNull().default(30), // configurable per file
  // Timestamps
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
  warnedAt: timestamp("warned_at"),
  deletedAt: timestamp("deleted_at"),
  // Metadata
  isPublic: boolean("is_public").notNull().default(false),
  description: text("description"),
})

// ─── Decay Events ─────────────────────────────────────────
// Audit log of every decay action
export const decayEvents = pgTable("decay_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'warned' | 'compressed' | 'critical' | 'deleted' | 'renewed'
  decayScoreAtEvent: real("decay_score_at_event").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Types ─────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert
export type DecayEvent = typeof decayEvents.$inferSelect
