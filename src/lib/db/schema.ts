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

// [P18] Added 'trial' and 'trial_expired'
export const planEnum = pgEnum("plan", ["free", "starter", "pro", "trial", "trial_expired"])

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
  emailDigestEnabled:    boolean("email_digest_enabled").notNull().default(true),
  // [P12-1] Lets users silence the 50%/90%/pre-deletion decay warning emails.
  decayWarningsEnabled:  boolean("decay_warnings_enabled").notNull().default(true),
  // [P18] Trial columns
  trialEndsAt:           timestamp("trial_ends_at"),
  trialExpiredAt:        timestamp("trial_expired_at"),
  createdVia:            text("created_via").notNull().default("direct"),
})

// ─── Folders ──────────────────────────────────────────────
export const folders = pgTable("folders", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId:  uuid("parent_id"),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
  defaultDecayRateDays: integer("default_decay_rate_days"),
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
  publicDownloadCount:  integer("public_download_count").notNull().default(0),
  description:          text("description"),
  // [P6-3] Tracks whether the client completed the R2 PUT after receiving
  // the presigned URL. Unconfirmed records older than 1 hour are ghost files
  // and are pruned by the decay cron. Default false; set true by POST /api/files/[id]/confirm.
  uploadConfirmed:      boolean("upload_confirmed").notNull().default(false),
  tags:                 text("tags").array().notNull().default([]),
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

// ─── Storage Snapshots ────────────────────────────────────
// [P9-3] Daily cron writes a snapshot of storage used per user
export const storageSnapshots = pgTable("storage_snapshots", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull(),
  fileCount:        integer("file_count").notNull().default(0),
  snapshotDate:     timestamp("snapshot_date").defaultNow().notNull(),
})

// ─── Waitlist ─────────────────────────────────────────────
// [P18] Controlled rollout queue. status: pending | approved | token_expired | signed_up
export const waitlist = pgTable("waitlist", {
  id:             uuid("id").primaryKey().defaultRandom(),
  email:          text("email").notNull().unique(),
  status:         text("status").notNull().default("pending"),
  token:          text("token").unique(),
  tokenExpiresAt: timestamp("token_expires_at"),
  joinedAt:       timestamp("joined_at").defaultNow().notNull(),
  approvedAt:     timestamp("approved_at"),
  signedUpAt:     timestamp("signed_up_at"),
})

// ─── Types ────────────────────────────────────────────────
export type User            = typeof users.$inferSelect
export type NewUser         = typeof users.$inferInsert
export type Folder          = typeof folders.$inferSelect
export type NewFolder       = typeof folders.$inferInsert
export type File            = typeof files.$inferSelect
export type NewFile         = typeof files.$inferInsert
export type FileVersion     = typeof fileVersions.$inferSelect
export type DecayEvent      = typeof decayEvents.$inferSelect
export type ApiKey          = typeof apiKeys.$inferSelect
export type StorageSnapshot = typeof storageSnapshots.$inferSelect
export type Waitlist        = typeof waitlist.$inferSelect
export type NewWaitlist     = typeof waitlist.$inferInsert