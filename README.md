# DecayStore 🕰️

> Storage with a memory. Files decay when ignored.

A Next.js SaaS where uploaded files slowly decay and auto-delete if not accessed. Users renew files they care about — everything else disappears.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Local Development](#local-development)
5. [Known Limitations](#known-limitations)
6. [Security Audit — Beta 8](#security-audit--beta-8)
7. [Change Log](#change-log)
8. [Roadmap](#roadmap)
9. [Legal & License](#legal--license)

---

## Tech Stack

| Layer        | Tool                       | Cost at MVP                    |
|--------------|----------------------------|--------------------------------|
| Framework    | Next.js 14 (App Router)    | Free                           |
| Auth         | Clerk                      | Free tier                      |
| Database     | Neon (serverless Postgres) | Free tier                      |
| Storage      | Cloudflare R2              | ~$0.015/GB/mo, zero egress     |
| Billing      | LemonSqueezy               | 5% + $0.50 per transaction     |
| Email        | Resend                     | Free up to 3,000/mo            |
| Hosting+Cron | Vercel                     | Free tier                      |

**Estimated infra cost at 100 users: ~$5–15/month**

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

### 3. Configure services

**Clerk** — https://dashboard.clerk.com
- Create a new app
- Copy the publishable key and secret key
- Set redirect URLs to match your `.env.local`

**Neon** — https://neon.tech
- Create a new project
- Copy the connection string (`DATABASE_URL`)
- The app uses the `neon-http` driver (no WebSocket needed, but no transactions)

**Cloudflare R2** — https://dash.cloudflare.com
- Create an R2 bucket (e.g. `decaystore-files`)
- Go to **R2 → Manage R2 API Tokens → Create API Token**
- Set permission to **Object Read & Write**, scoped to your bucket
- Copy the **Access Key ID** → `R2_ACCESS_KEY_ID`
- Copy the **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
- Copy your **Account ID** (32-char hex from the Cloudflare sidebar) → `R2_ACCOUNT_ID`
- ⚠️ Do NOT use the `cfat_...` token value — that is the Cloudflare API token, not the S3 credentials
- Set the following **CORS policy** on your bucket (R2 → bucket → Settings → CORS):

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.vercel.app"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

**LemonSqueezy** — https://app.lemonsqueezy.com
- Create a store and two products: "Starter" ($5/mo) and "Pro" ($15/mo)
- Copy each product's Variant ID → `LEMONSQUEEZY_VARIANT_STARTER` / `LEMONSQUEEZY_VARIANT_PRO`
- Copy your Store ID → `LEMONSQUEEZY_STORE_ID`
- Create an API key → `LEMONSQUEEZY_API_KEY`
- Set up a webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`
- Subscribe to: `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
- Copy the webhook signing secret → `LEMONSQUEEZY_WEBHOOK_SECRET`

**Resend** — https://resend.com
- Create an account and verify your sending domain
- Create an API key → `RESEND_API_KEY`

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon (Postgres)
DATABASE_URL=

# Cloudflare R2
R2_ACCOUNT_ID=         # 32-char hex Account ID from Cloudflare sidebar
R2_ACCESS_KEY_ID=      # S3 Access Key ID (not the cfat_ token)
R2_SECRET_ACCESS_KEY=  # S3 Secret Access Key
R2_BUCKET_NAME=        # e.g. decaystore-files

# LemonSqueezy
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_STARTER=
LEMONSQUEEZY_VARIANT_PRO=
LEMONSQUEEZY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=   # e.g. https://yourdomain.vercel.app

# Resend
RESEND_API_KEY=

# Cron protection
CRON_SECRET=           # Long random string — e.g. openssl rand -hex 32
```

### Triggering crons manually (non-Vercel)

```bash
curl -X GET https://yourdomain.com/api/cron/decay \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X GET https://yourdomain.com/api/cron/digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Local Development

```bash
npm run dev          # Start dev server
npm run db:migrate   # Run Drizzle migrations
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

Uploads go directly to R2 via presigned URLs — R2 credentials and bucket must be configured even locally. Add `http://localhost:3000` to your R2 CORS policy for local testing.

---

## Known Limitations

- **No DB transactions:** The `neon-http` driver does not support transactions. Storage counters use atomic SQL increments which prevents most race conditions, but is not fully ACID. Switch to `neon-serverless` for full transaction support.
- **Cron scaling:** The decay cron processes all files in memory. At very high file counts this may approach Vercel's 60s function timeout. Cursor-based pagination is planned.
- **Orphan guard on failed upload:** If a browser upload to R2 fails mid-transfer, the DB record (with `uploadConfirmed = false`) is cleaned up by the nightly cron after 1 hour.
- **Rate limiter is per-instance:** The in-memory rate limiter does not share state across Vercel function instances. For production scale, replace with Upstash Redis.

---

## Security Audit — Beta 8

### Overall Score: 96 / 100 — Production Ready 🚀

Full audit against OWASP Top 10 (2021), OWASP API Security Top 10, and general SaaS hardening benchmarks.

| Category | Weight | Score | Notes |
|---|---|---|---|
| Authentication & Session Management | 20% | 20/20 | Clerk enforced on all protected routes; middleware matcher correct |
| Authorization / IDOR Prevention | 20% | 20/20 | Every DB query scoped to `user.id` |
| Input Validation & Injection | 15% | 14/15 | Zod uniform across all mutation endpoints; MIME allowlist enforced |
| Secrets & Credential Hygiene | 15% | 15/15 | Timing-safe HMAC; all secrets in env vars |
| Security Headers & Transport | 10% | 10/10 | Full header suite: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Webhook & External Integration | 10% | 10/10 | `timingSafeEqual` in place; webhook handler correct |
| Rate Limiting & Abuse Prevention | 5% | 4/5 | In-memory limiter (single instance); accepted for MVP |
| Client-side Storage & Data Exposure | 5% | 3/5 | `localStorage` for dismissed notification IDs — see B8-N1 |

**Total: 96 / 100**

### All Findings

| ID | Severity | Issue | Status |
|---|---|---|---|
| S1 | 🔴 High | Webhook HMAC used `===` instead of `timingSafeEqual` | ✅ Closed |
| S2 | 🔴 High | No HTTP security headers | ✅ Closed |
| S3 | 🟡 Medium | No rate limiting on upload or checkout endpoints | ✅ Closed |
| S4 | 🟡 Medium | MIME type not validated server-side | ✅ Closed |
| S5 | 🟡 Medium | `serverActions.bodySizeLimit: '100mb'` unnecessarily large | ✅ Closed |
| S6 | 🟢 Low | Zod not used uniformly across API routes | ✅ Closed |
| S7 | 🟢 Low | `require("crypto")` inside function body | ✅ Closed |
| S8 | 🟢 Low | Cron route defence undocumented | ✅ Closed |
| B8-N1 | 🟡 Medium | `localStorage` dismissed-ID cap off-by-one | Accepted / MVP |
| B8-N2 | 🟢 Low | `sessionStorage` toast leaks to cloned tabs | Accepted / MVP |
| B8-N3 | 🟢 Low | Stale-closure risk on notification callbacks | Doc fix recommended |
| B8-N4 | 🟢 Low | Mobile modal missing focus trap (WCAG 2.1.2) | Deferred |
| B8-N5 | ℹ️ Info | No new API surface from notification system | ✅ Confirmed clean |

---

## Change Log

All phases are non-breaking and applied in sequence.

---

### Phase 1 — Critical Data Integrity ✅

**R2 leaks, storage accounting, folder cascade mismatch**

- **[P1-1]** Version upload now deletes the old R2 object and decrements storage for the displaced bytes.
- **[P1-2]** Manual file delete now fetches all version records, deletes every R2 object by key, removes the version DB rows, then marks the file deleted. No orphaned R2 objects.
- **[P1-3]** Decay cron performs the same full-version R2 cleanup as manual delete when a file reaches decay score 1.0.
- **[P1-4]** Storage counter is decremented for the displaced version on re-upload, keeping `storageUsedBytes` accurate across versioning.
- **[P1-5]** Migration corrects `folders.parent_id` from `ON DELETE CASCADE` to `ON DELETE SET NULL`, matching app-level "move sub-folders to root" behaviour on folder delete.

---

### Phase 2 — Code Quality & Naming ✅

**Duplicate exports, naming confusion, dead code, bad imports**

- **[P2-1]** Renamed `stripe.ts` → `lemonsqueezy.ts`. All imports updated — the Stripe name was actively misleading.
- **[P2-2]** `lemonsqueezy.ts` now imports `PLANS` and `PLAN_STORAGE_LIMITS` from `plans.ts` instead of re-declaring them. Single source of truth.
- **[P2-3]** Renamed `stripeCustomerId` → `billingCustomerId` and `stripeSubscriptionId` → `billingSubscriptionId`. Migration + all call-sites updated.
- **[P2-4]** Removed unused `@lemonsqueezy/lemonsqueezy.js` SDK — all LS API calls use `fetch`.
- **[P2-5]** Removed unused `dotenv` dependency — Next.js handles `.env` loading natively.
- **[P2-6]** Deleted `src/app/api/r2-test/route.ts` — development-only route removed before production.
- **[P2-7]** Replaced inline `await import(...)` calls in the version delete handler with static top-of-file imports.

---

### Phase 3 — Performance ✅

**Cron N+1 queries, expensive file count, R2 key collisions**

- **[P3-1]** Cron batch user lookup — collects all affected `userId` values, fetches all users in a single `WHERE id IN (...)` query. Eliminates per-file DB round-trips.
- **[P3-2]** File count check now uses `COUNT(*)` instead of loading every file row.
- **[P3-3]** `getOrCreateUser` collapses check-then-insert into a single `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`.
- **[P3-4]** `buildR2Key` uses `crypto.randomUUID()` instead of `Date.now()`, eliminating same-millisecond key collision risk.

---

### Phase 4 — Security Hardening ✅

**All 8 findings from Beta 4 security audit**

- **[S1]** `verifyLemonSqueezyWebhook` now uses `timingSafeEqual` on `Buffer` digests — closes timing-oracle attack on webhook signature verification.
- **[S2]** `next.config.js` emits `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a full `Content-Security-Policy` on every response.
- **[S3]** New `src/lib/rate-limit.ts` sliding-window counter. Applied to `POST /api/files` (20 req/min) and `POST /api/stripe/checkout` (5 req/min) with `429` + `Retry-After` header.
- **[S4]** `POST /api/files` validates `contentType` against a server-side `ALLOWED_MIME_TYPES` set (~35 types). Unsupported types rejected with `415`.
- **[S5]** Removed `serverActions.bodySizeLimit: '100mb'` — uploads bypass the server via presigned URLs, so the default 1 MB limit is correct.
- **[S6]** `POST /api/folders`, `PATCH /api/files/[id]/rename`, and `POST /api/files` now parse request bodies through Zod schemas.
- **[S7]** Replaced `require("crypto")` inside function body with top-of-file ESM import.
- **[S8]** Inline comment in `middleware.ts` documents the two-layer cron defence model and links to Vercel firewall docs.

---

### Phase 5 — Plan Integrity ✅

**Delivering features advertised on the pricing page**

- **[P5-1] Custom decay rates per file (Pro)** — Decay rate selector in the upload modal (7 / 14 / 30 / 60 / 90 / 180 / 365 days), visible to Pro users only. New `PATCH /api/files/[id]/decay-rate` endpoint, Pro-gated. Server ignores client-supplied rate for Free/Starter users.
- **[P5-2] API key management (Pro)** — New `apiKeys` table. `GET/POST/DELETE /api/keys` endpoints: list keys (safe fields only), generate `dsk_`-prefixed keys (raw key returned once, only hash stored), revoke by ID. Max 10 keys per user. New `ApiKeysPanel` dashboard component. Full API reference at `/api-docs`.
- **[P5-3] Priority support routing (Starter + Pro)** — "Support" button in dashboard header opens a pre-filled `mailto:` with plan and email. Tooltip shows expected response time (Pro: 24h, Starter: 48h).

**Migration required:**

```sql
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  last_used_at TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX api_keys_key_hash_idx ON api_keys(key_hash);
```

**Files changed:**

| File | Status |
|---|---|
| `src/app/api/files/route.ts` | Modified |
| `src/app/api/files/[id]/decay-rate/route.ts` | New |
| `src/app/api/keys/route.ts` | New |
| `src/app/api-docs/page.tsx` | New |
| `src/components/dashboard/FileUploader.tsx` | Modified |
| `src/components/dashboard/ApiKeysPanel.tsx` | New |
| `src/components/dashboard/DashboardHeader.tsx` | Modified |
| `src/lib/db/schema.ts` | Modified |

---

### Phase 6 — Upgrade & Onboarding Experience ✅

**Paying users feel the value immediately. New users understand the product from the first second.**

- **[P6-1] Post-upgrade confirmation banner** — `UpgradeBanner` shown once when landing on `/dashboard?upgraded=true` after checkout. Strips the query param from the URL, lists every feature unlocked on the new plan. Dismissal persisted to `localStorage` keyed by `plan + userId`.
- **[P6-2] First-use onboarding + decay explainer** — `OnboardingBanner` shown once to new users (keyed to `localStorage: ds_onboarded_v1`). Explains decay, shows the colour-coded decay scale, and the three core rules. `DecayExplainer` collapsible strip always available below the storage bar — shows a gradient timeline with labelled milestones (warning at 50%, critical at 90%, deletion at 100%) calibrated to the user's plan window.
- **[P6-3] Orphaned upload record cleanup** — `uploadConfirmed boolean default false` added to `files` table. `POST /api/files/[id]/confirm` sets it to `true` after the R2 PUT succeeds. `GET /api/files` filters to `uploadConfirmed = true` — ghost records never appear in the dashboard. Decay cron prunes `uploadConfirmed = false` records older than 1 hour.

**Migration required:**

```sql
ALTER TABLE files ADD COLUMN upload_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE files SET upload_confirmed = TRUE;
CREATE INDEX files_upload_confirmed_idx ON files(upload_confirmed, uploaded_at)
  WHERE upload_confirmed = FALSE;
```

**Files changed:**

| File | Status |
|---|---|
| `src/components/dashboard/UpgradeBanner.tsx` | New |
| `src/components/dashboard/OnboardingBanner.tsx` | New |
| `src/app/dashboard/page.tsx` | Modified |
| `src/app/api/files/[id]/confirm/route.ts` | New |
| `src/app/api/files/route.ts` | Modified |
| `src/components/dashboard/FileUploader.tsx` | Modified |
| `src/lib/decay.ts` | Modified |
| `src/lib/db/schema.ts` | Modified |

---

### Phase 7 — Power User Features ✅

**Search, bulk actions, and public sharing for users managing files at scale.**

- **[P7-1] Search and filter** — Search input filters the file grid client-side by filename (instant, no API call). Sort dropdown: Decay / Name A–Z / Size / Upload date. Filter pills: All / Images / Documents / Video / Audio / Archives. Live `filtered/total` count shown.
- **[P7-2] Bulk file actions** — Checkbox on each file card (hover-visible; always visible when any file is selected). Sticky bulk action bar: Renew all, Move to folder (folder picker modal), Delete all (with inline confirmation). All bulk ops use `Promise.all()` with a concurrency cap of 4.
- **[P7-3] Public / shared file links (Pro)** — Public share page at `/share/[fileId]`. Per-IP rate limit (10 req/min). Resets decay clock and increments `publicDownloadCount` on every access. Shows file info, decay health strip, download count, and a presigned download button. Open Graph metadata generated. No auth required. Share toggle and Copy link in the `⋯` overflow menu (Pro only).

**Migration required:**

```sql
ALTER TABLE files ADD COLUMN public_download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN email_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE folders ADD COLUMN default_decay_rate_days INTEGER;
CREATE TABLE storage_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT NOT NULL,
  file_count         INTEGER NOT NULL DEFAULT 0,
  snapshot_date      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Files changed:**

| File | Status |
|---|---|
| `src/components/dashboard/FileGrid.tsx` | Modified |
| `src/app/share/[fileId]/page.tsx` | New |
| `src/app/api/files/[id]/route.ts` | Modified |
| `src/lib/db/schema.ts` | Modified |

---

### Phase 8 — Transparency & Trust ✅

**Surfacing existing data to build user confidence.**

- **[P8-1] Activity log (Starter + Pro)** — `GET /api/activity` returns `decayEvents` for the current user, paginated (50/page), newest first. Optional `?fileId=` filter with IDOR ownership guard. Pro users can append `?export=csv` for a full CSV download. `ActivityPanel` component: severity-coded event list, per-row file filter, Prev/Next pagination, Export CSV button (Pro). Desktop: inline `420px` panel. Mobile: full-height right drawer.
- **[P8-2] Weekly decay email digest (Starter + Pro)** — `GET /api/cron/digest` runs every Monday at 09:00 UTC (Vercel cron). Fetches all Starter + Pro users with `emailDigestEnabled = true`, computes live decay scores, and sends a digest email for users with files ≥ 50% decayed. Digest includes file name, decay %, days remaining, and a one-click HMAC-signed renewal URL (7-day expiry, no login required).
- **[P8-3] Folder-level decay defaults (Pro)** — `defaultDecayRateDays` column on `folders` table (pre-added in Phase 7). Folder `⋯` menu (Pro only) opens a decay settings modal. Files uploaded into a folder inherit its default rate. `FileUploader` picker initialises to the folder default and shows a "(folder default)" label hint.

**No new migration required** — all columns were pre-added in Phase 7.

**Files changed:**

| File | Status |
|---|---|
| `src/app/api/activity/route.ts` | New |
| `src/app/api/cron/digest/route.ts` | New |
| `src/components/dashboard/ActivityPanel.tsx` | New |
| `src/lib/email.ts` | Modified |
| `src/components/dashboard/FolderSidebar.tsx` | Modified |
| `src/components/dashboard/FileUploader.tsx` | Modified |
| `src/app/api/folders/[id]/route.ts` | Modified |
| `src/app/dashboard/page.tsx` | Modified |
| `vercel.json` | Modified |

---

### Bug Fixes (Post-Phase 8) ✅

- **[BF-1] File upload 400 error** — `FileUploader` was sending `folderId: null` when no folder was selected. The server's Zod schema defines `folderId` as `string().uuid().optional()` — it accepts `undefined` but rejects `null`. Fixed by omitting the key entirely when `currentFolderId` is `null`.
- **[BF-2] Uploaded files required page refresh to appear** — The `/confirm` call was fire-and-forget, so `fetchAll()` (which filters to `uploadConfirmed = true`) was called before the server had confirmed the upload. Fixed by awaiting the confirm call before invoking `onUploadComplete()`.

---

## Roadmap

### Phase 9 — Polish & Retention

| Feature | Plans | Notes |
|---|---|---|
| **[P9-1] Dark/light mode toggle** | All | Sun/moon toggle in header. Persists to `localStorage`. Toggles `data-theme` on `<html>`. |
| **[P9-2] File tagging / labels** | All | Tag chips in Details modal. Filter pills in file grid. |
| **[P9-3] Usage analytics** | Pro | Daily storage snapshots. Analytics panel: storage trend chart, files by decay status, top renewed files. |
| **[P9-4] Drag-and-drop folder organisation** | All | `@dnd-kit/core` integration. Drag file card over folder card to trigger move. |

### Full Roadmap Summary

| Phase | Focus | Status |
|---|---|---|
| P1 | Critical data integrity | ✅ Done |
| P2 | Code quality & naming | ✅ Done |
| P3 | Performance | ✅ Done |
| P4 | Security hardening | ✅ Done |
| P5 | Plan integrity — fix advertised features | ✅ Done |
| P6 | Upgrade & onboarding experience | ✅ Done |
| P7 | Power user features | ✅ Done |
| P8 | Transparency & trust | ✅ Done |
| P9 | Polish & retention | 🟡 In progress |

---

## Legal & License

- [Privacy Policy](/legal/privacy)
- [Terms of Service](/legal/terms)
- [Cookie Policy](/legal/cookies)

Contact: legal@decaystore.com

MIT License