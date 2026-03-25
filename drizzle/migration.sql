-- Run this migration via: npm run db:migrate
-- Or paste directly into Neon SQL editor

-- ── Folders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "folders" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "parent_id"  UUID REFERENCES "folders"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ── Add folder_id + versioning columns to files ───────────
ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "folder_id"               UUID REFERENCES "folders"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "current_version_number"  INTEGER NOT NULL DEFAULT 1;

-- ── File Versions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "file_versions" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_id"        UUID NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "r2_key"         TEXT NOT NULL UNIQUE,
  "size_bytes"     BIGINT NOT NULL,
  "label"          TEXT,
  "uploaded_at"    TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ── Backfill: create version 1 for every existing file ────
-- This seeds fileVersions so existing files have a v1 record.
INSERT INTO "file_versions" ("file_id", "user_id", "version_number", "r2_key", "size_bytes", "uploaded_at")
SELECT "id", "user_id", 1, "r2_key", "size_bytes", "uploaded_at"
FROM "files"
WHERE "status" != 'deleted'
ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "folders_user_id_idx"       ON "folders"("user_id");
CREATE INDEX IF NOT EXISTS "folders_parent_id_idx"     ON "folders"("parent_id");
CREATE INDEX IF NOT EXISTS "files_folder_id_idx"       ON "files"("folder_id");
CREATE INDEX IF NOT EXISTS "file_versions_file_id_idx" ON "file_versions"("file_id");