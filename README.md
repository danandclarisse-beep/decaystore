# DecayStore 🕰️

> Storage with a memory. Files decay when ignored.

A Next.js SaaS where uploaded files slowly decay and auto-delete if not accessed. Users renew files they care about — everything else disappears.

---

## Tech Stack

| Layer        | Tool                        | Cost at MVP                              |
|--------------|-----------------------------|------------------------------------------|
| Framework    | Next.js 14 (App Router)     | Free                                     |
| Auth         | Clerk                       | Free tier                                |
| Database     | Neon (serverless Postgres)  | Free tier                                |
| Storage      | Cloudflare R2               | ~$0.015/GB/mo, **zero egress**           |
| Billing      | LemonSqueezy                | 5% + $0.50 per transaction               |
| Email        | Resend                      | Free up to 3,000/mo                      |
| Hosting+Cron | Vercel                      | Free tier                                |

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

### 3. Set up services

**Clerk** — https://dashboard.clerk.com
- Create a new app
- Copy publishable key and secret key
- Set redirect URLs to match your `.env.local`

**Neon** — https://neon.tech
- Create a new project
- Copy the connection string (`DATABASE_URL`)
- The app uses `neon-http` driver (no WebSocket needed, but no transactions)

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
- Set up a webhook endpoint at `/api/webhooks/stripe` pointing to your deployed URL
- Subscribe to: `order_created`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
- Copy the webhook signing secret → `LEMONSQUEEZY_WEBHOOK_SECRET`

**Resend** — https://resend.com
- Create an account and verify your sending domain
- Create an API key → `RESEND_API_KEY`

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/decay/         # Nightly decay runner
│   │   ├── files/              # File CRUD + presigned URLs
│   │   ├── files/[id]/         # Download, renew, delete
│   │   ├── files/[id]/versions/              # Version list + new version upload
│   │   ├── files/[id]/versions/[versionId]/  # Version download + delete
│   │   ├── files/[id]/move/    # Move file to folder
│   │   ├── files/[id]/rename/  # Rename file display name
│   │   ├── folders/            # Folder CRUD
│   │   ├── folders/[id]/       # Rename + delete folder
│   │   ├── stripe/             # Checkout + billing portal (LemonSqueezy)
│   │   └── webhooks/           # LemonSqueezy webhook handler
│   ├── auth/                   # Sign-in / sign-up (Clerk)
│   ├── about/                  # About page
│   ├── contact/                # Contact page
│   ├── dashboard/              # Main app view
│   ├── legal/
│   │   ├── privacy/            # Privacy Policy
│   │   ├── terms/              # Terms of Service
│   │   └── cookies/            # Cookie Policy
│   ├── pricing/                # Pricing + FAQ
│   └── page.tsx                # Landing page
├── components/
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx
│   │   ├── FileGrid.tsx
│   │   ├── FileUploader.tsx
│   │   ├── FolderSidebar.tsx
│   │   └── StorageBar.tsx
│   └── shared/
│       ├── Nav.tsx             # Shared sticky nav (all public pages)
│       └── Footer.tsx          # Shared footer with legal links
├── lib/
│   ├── db/
│   │   ├── index.ts            # Neon + Drizzle connection
│   │   └── schema.ts           # Database schema
│   ├── auth-helpers.ts         # Clerk → DB user sync
│   ├── decay.ts                # Core decay engine (server-only)
│   ├── decay-utils.ts          # Decay helpers (client-safe)
│   ├── email.ts                # Resend email templates
│   ├── lemonsqueezy.ts         # LemonSqueezy client (was stripe.ts)
│   ├── plans.ts                # Plan definitions (client-safe, single source of truth)
│   ├── r2.ts                   # Cloudflare R2 client + presigned URLs
│   └── utils.ts                # Shared utilities
└── middleware.ts               # Route protection (Clerk)
```

---

## Upload Architecture

Files are uploaded **browser → R2 directly** using presigned URLs. Vercel never handles file bytes, so there is no serverless body size limit.

```
1. Browser  →  POST /api/files  (JSON: filename, size, type)
               Server validates quota, inserts DB record, returns presigned URL

2. Browser  →  PUT {presignedUrl}  (raw file bytes → Cloudflare R2)
               Direct upload, no Vercel involved
```

This supports files up to **5 GB** on any Vercel plan.

### Concurrent upload safety

- `storageUsedBytes` uses an atomic SQL increment (`storage_used_bytes + $size`) instead of read-modify-write, preventing race conditions under concurrent uploads.
- Delete uses `GREATEST(0, storage_used_bytes - $size)` to prevent negative values.
- Note: Neon's `neon-http` driver does not support transactions. If you need full ACID guarantees, switch to `neon-serverless` (WebSocket driver) in `src/lib/db/index.ts`.

---

## Decay Logic

Core logic in `src/lib/decay.ts`:

```
decay_score = days_since_last_access / decay_rate_days

0.00 → Fresh     (just uploaded or accessed)
0.50 → Warning   (email sent)
0.75 → Stale     (second warning)
0.90 → Critical  (final warning)
1.00 → Deleted   (permanently removed from R2)
```

The cron job at `/api/cron/decay` runs nightly at 2AM UTC via `vercel.json`.

### Decay rates by plan

| Plan            | Decay window | Storage | Files     |
|-----------------|-------------|---------|-----------|
| Free            | 14 days     | 1 GB    | 10        |
| Starter ($5/mo) | 30 days     | 25 GB   | 500       |
| Pro ($15/mo)    | 90 days     | 100 GB  | Unlimited |

---

## Pages & Routes

| Route              | Auth     | Description                        |
|--------------------|----------|------------------------------------|
| `/`                | Public   | Landing page                       |
| `/pricing`         | Public   | Pricing plans + FAQ                |
| `/about`           | Public   | About DecayStore                   |
| `/contact`         | Public   | Contact / support emails           |
| `/legal/privacy`   | Public   | Privacy Policy                     |
| `/legal/terms`     | Public   | Terms of Service                   |
| `/legal/cookies`   | Public   | Cookie Policy                      |
| `/dashboard`       | Required | File manager                       |
| `/auth/sign-in`    | Public   | Clerk sign-in                      |
| `/auth/sign-up`    | Public   | Clerk sign-up                      |

---

## Design System

The app uses a dark-first design system defined in `globals.css`:

| Token               | Value      | Use                          |
|---------------------|------------|------------------------------|
| `--bg`              | `#0a0a0b`  | Page background              |
| `--bg-elevated`     | `#111113`  | Elevated surfaces            |
| `--bg-card`         | `#16161a`  | Cards, panels                |
| `--bg-hover`        | `#1c1c21`  | Hover states                 |
| `--border`          | `#242429`  | Standard borders             |
| `--border-subtle`   | `#1a1a1f`  | Subtle dividers              |
| `--text`            | `#f0f0f2`  | Primary text                 |
| `--text-muted`      | `#6b6b7a`  | Secondary text               |
| `--accent`          | `#f5a623`  | Brand amber, CTAs            |

**Fonts:** Syne (headings) · DM Sans (body) · DM Mono (code/mono)

---

## Deployment

### Vercel

```bash
npm install -g vercel
vercel
```

Set all environment variables in Vercel → Project → Settings → Environment Variables. Make sure all vars are enabled for the **Production** environment.

The cron job is configured via `vercel.json` and runs automatically. Vercel calls `/api/cron/decay` nightly with `Authorization: Bearer <CRON_SECRET>`.

### Required environment variables

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
R2_ACCOUNT_ID=          # 32-char hex Account ID from Cloudflare sidebar
R2_ACCESS_KEY_ID=       # S3 Access Key ID (not the cfat_ token)
R2_SECRET_ACCESS_KEY=   # S3 Secret Access Key
R2_BUCKET_NAME=         # e.g. decaystore-files

# LemonSqueezy
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_STARTER=
LEMONSQUEEZY_VARIANT_PRO=
LEMONSQUEEZY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=    # e.g. https://yourdomain.vercel.app

# Resend
RESEND_API_KEY=

# Cron protection
CRON_SECRET=            # Long random string, e.g. openssl rand -hex 32
```

### Manual cron trigger (non-Vercel)

```bash
curl -X GET https://yourdomain.com/api/cron/decay \
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

- **No transactions:** The `neon-http` driver does not support DB transactions. Storage counters use atomic SQL increments which prevents most race conditions, but is not fully ACID. Switch to `neon-serverless` for full transaction support.
- **Cron scaling:** The nightly decay cron currently processes all files in memory. At very high file counts this may approach Vercel's 60s function timeout. Cursor-based pagination is planned for a future phase.
- **Orphan guard on failed upload:** If the browser upload to R2 fails mid-transfer, a DB record exists with no corresponding R2 object. The file will appear in the dashboard but fail to download. A future cleanup sweep will handle stale unconfirmed records.

---

## Fix & Enhancement Log

Tracked from the Beta 3 audit. Each phase is non-breaking and applied in sequence.
README is updated after each confirmed phase.

### Phase 1 — Critical data integrity ✅
*R2 leaks, storage accounting, folder cascade mismatch*

- **[P1-1] Version upload: delete old R2 object** — `POST /api/files/[id]/versions` now calls `deleteFromR2` on the previous `r2Key` before updating the file record, and decrements `storageUsedBytes` for the displaced bytes.
- **[P1-2] Manual delete: purge all version R2 objects** — `DELETE /api/files/[id]` now fetches all `fileVersions` records, deletes every R2 object by key, deletes the version DB rows, then marks the parent file deleted. No orphaned R2 objects.
- **[P1-3] Decay cron: purge all version objects on auto-delete** — `runDecayCycle()` performs the same full-version R2 cleanup as manual delete when a file reaches decay score 1.0.
- **[P1-4] Storage accounting: subtract old version bytes on re-upload** — `storageUsedBytes` is decremented for the displaced version when a new version is uploaded, keeping the counter accurate across re-uploads.
- **[P1-5] Folder cascade: align DB to app logic** — Migration corrects `folders.parent_id` from `ON DELETE CASCADE` to `ON DELETE SET NULL`, matching the app-level "move sub-folders to root" behavior on folder delete.

### Phase 2 — Code quality & naming ✅
*Duplicate exports, naming confusion, dead code, bad imports*

- **[P2-1] Rename `stripe.ts` → `lemonsqueezy.ts`** — All imports updated. The file has used LemonSqueezy since billing migration; the Stripe name was actively misleading.
- **[P2-2] Eliminate duplicate plan definitions** — `lemonsqueezy.ts` now imports `PLANS` and `PLAN_STORAGE_LIMITS` from `plans.ts` instead of re-declaring them. Single source of truth.
- **[P2-3] Rename billing schema fields** — `stripeCustomerId` → `billingCustomerId`, `stripeSubscriptionId` → `billingSubscriptionId`. Migration + all call-site updates applied.
- **[P2-4] Remove unused `@lemonsqueezy/lemonsqueezy.js` SDK** — All LS API calls are done via `fetch`; the official SDK was never imported.
- **[P2-5] Remove unused `dotenv` dependency** — Next.js handles `.env` loading natively.
- **[P2-6] Delete `src/app/api/r2-test/route.ts`** — Development-only route removed before it could ship to production.
- **[P2-7] Fix dynamic imports in version delete handler** — Static top-of-file imports replace the inline `await import(...)` calls that were used to work around a TypeScript inference issue.

### Phase 3 — Performance ✅
*Cron N+1 queries, expensive file count, R2 key collisions*

- **[P3-1] Cron: batch user lookups** — `runDecayCycle()` collects all affected `userId` values before iterating, fetches all users in a single `WHERE id IN (...)` query, and uses an in-memory map — eliminating the per-file DB round-trip.
- **[P3-2] `POST /api/files`: `COUNT(*)` instead of `findMany`** — File count check no longer loads every file row; uses a single `COUNT` query.
- **[P3-3] `getOrCreateUser`: single-query upsert** — Replaced the check-then-insert pattern with `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`, collapsing two DB round-trips into one.
- **[P3-4] `buildR2Key`: UUID prefix instead of `Date.now()`** — `crypto.randomUUID()` replaces the millisecond timestamp, eliminating the theoretical same-millisecond key collision.

---

## Legal

- [Privacy Policy](/legal/privacy)
- [Terms of Service](/legal/terms)
- [Cookie Policy](/legal/cookies)

Contact: legal@decaystore.com

---

## License

MIT