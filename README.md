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
| Billing      | Stripe                      | 2.9% + 30¢ per transaction               |
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

**Stripe** — https://dashboard.stripe.com
- Create two products: "Starter" ($5/mo) and "Pro" ($15/mo)
- Copy the price IDs into `.env.local`
- Set up a webhook endpoint at `/api/webhooks/stripe`
- Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

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
│   │   ├── stripe/             # Checkout + billing portal
│   │   └── webhooks/           # Stripe webhook handler
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
│   ├── r2.ts                   # Cloudflare R2 client + presigned URLs
│   ├── stripe.ts               # Stripe client + plans
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

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_LS_VARIANT_STARTER=
NEXT_PUBLIC_LS_VARIANT_PRO=

# Resend
RESEND_API_KEY=

# Cron protection
CRON_SECRET=
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
- **Cron scaling:** The nightly decay cron processes files sequentially. At very high file counts (100k+), it may approach Vercel's 60s timeout. Consider batching or moving to a queue at scale.
- **No file versioning:** Uploading a file with the same name creates a new entry. There is no version history.

---

## Legal

- [Privacy Policy](/legal/privacy)
- [Terms of Service](/legal/terms)
- [Cookie Policy](/legal/cookies)

Contact: legal@decaystore.com

---

## License

MIT