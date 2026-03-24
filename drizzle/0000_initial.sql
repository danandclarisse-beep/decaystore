-- DecayStore initial schema migration
-- Run via: drizzle-kit migrate

CREATE TYPE "file_status" AS ENUM ('active', 'warned', 'compressed', 'critical', 'deleted');
CREATE TYPE "plan" AS ENUM ('free', 'starter', 'pro');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clerk_id" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "plan" "plan" NOT NULL DEFAULT 'free',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "storage_used_bytes" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "r2_key" text NOT NULL UNIQUE,
  "filename" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "decay_score" real NOT NULL DEFAULT 0,
  "status" "file_status" NOT NULL DEFAULT 'active',
  "decay_rate_days" real NOT NULL DEFAULT 30,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  "last_accessed_at" timestamp DEFAULT now() NOT NULL,
  "warned_at" timestamp,
  "deleted_at" timestamp,
  "is_public" boolean NOT NULL DEFAULT false,
  "description" text
);

CREATE TABLE IF NOT EXISTS "decay_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "decay_score_at_event" real NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "files_user_id_idx" ON "files"("user_id");
CREATE INDEX IF NOT EXISTS "files_status_idx" ON "files"("status");
CREATE INDEX IF NOT EXISTS "files_decay_score_idx" ON "files"("decay_score");
CREATE INDEX IF NOT EXISTS "decay_events_file_id_idx" ON "decay_events"("file_id");
CREATE INDEX IF NOT EXISTS "users_clerk_id_idx" ON "users"("clerk_id");
