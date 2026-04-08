ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_expired_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_via" text NOT NULL DEFAULT 'direct';

CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"token" text,
	"token_expires_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"signed_up_at" timestamp,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_token_unique" UNIQUE("token")
);

CREATE INDEX IF NOT EXISTS "idx_waitlist_status" ON "waitlist" ("status");
CREATE INDEX IF NOT EXISTS "idx_waitlist_joined_at" ON "waitlist" ("joined_at");