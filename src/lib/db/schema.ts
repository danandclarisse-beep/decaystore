import {
  pgTable,
  text,
  timestamp,
  real,
  bigint,
  boolean,
  integer,
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
  id:                    uuid("id").primaryKey().defaultRandom(),
  clerkId:               text("clerk_id").notNull().unique(),
  email:                 text("email").notNull(),
  plan:                  planEnum("plan").notNull().default("free"),
  billingCustomerId:     text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"),
  storageUsedBytes:      bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
})

// ─── Folders ──────────────────────────────────────────────
export const folders = pgTable("folders", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId:  uuid("parent_id"),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Files ────────────────────────────────────────────────
export const files = pgTable("files", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  userId:               uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId:             uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  r2Key:                text("r2_key").notNull().unique(),
  filename:             text("filename").notNull(),
  originalFilename:     text("original_filename").notNull(),
  mimeType:             text("mime_type").notNull(),
  sizeBytes:            bigint("size_bytes", { mode: "number" }).notNull(),
  currentVersionNumber: integer("current_version_number").notNull().default(1),
  decayScore:           real("decay_score").notNull().default(0),
  status:               fileStatusEnum("status").notNull().default("active"),
  decayRateDays:        real("decay_rate_days").notNull().default(30),
  uploadedAt:           timestamp("uploaded_at").defaultNow().notNull(),
  lastAccessedAt:       timestamp("last_accessed_at").defaultNow().notNull(),
  warnedAt:             timestamp("warned_at"),
  deletedAt:            timestamp("deleted_at"),
  isPublic:             boolean("is_public").notNull().default(false),
  description:          text("description"),
})

// ─── File Versions ────────────────────────────────────────
export const fileVersions = pgTable("file_versions", {
  id:            uuid("id").primaryKey().defaultRandom(),
  fileId:        uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  userId:        uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  r2Key:         text("r2_key").notNull().unique(),
  sizeBytes:     bigint("size_bytes", { mode: "number" }).notNull(),
  label:         text("label"),
  uploadedAt:    timestamp("uploaded_at").defaultNow().notNull(),
})

// ─── Decay Events ─────────────────────────────────────────
export const decayEvents = pgTable("decay_events", {
  id:                uuid("id").primaryKey().defaultRandom(),
  fileId:            uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  userId:            uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType:         text("event_type").notNull(),
  decayScoreAtEvent: real("decay_score_at_event").notNull(),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
})

// ─── API Keys ─────────────────────────────────────────────
// [P5-2] Allows Pro users to authenticate programmatically via
// Authorization: Bearer <key> without a Clerk session.
// The raw key is shown once on creation and never stored.
// We store only a SHA-256 hash for comparison.
export const apiKeys = pgTable("api_keys", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label:      text("label").notNull(),
  keyHash:    text("key_hash").notNull().unique(), // SHA-256 hex of the raw key
  keyPrefix:  text("key_prefix").notNull(),        // First 8 chars for display ("dsk_a1b2c3d4…")
  lastUsedAt: timestamp("last_used_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
})

// ─── Types ────────────────────────────────────────────────
export type User        = typeof users.$inferSelect
export type NewUser     = typeof users.$inferInsert
export type Folder      = typeof folders.$inferSelect
export type NewFolder   = typeof folders.$inferInsert
export type File        = typeof files.$inferSelect
export type NewFile     = typeof files.$inferInsert
export type FileVersion = typeof fileVersions.$inferSelect
export type DecayEvent  = typeof decayEvents.$inferSelect
export type ApiKey      = typeof apiKeys.$inferSelect