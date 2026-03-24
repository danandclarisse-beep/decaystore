# DecayStore 🕰️

> Storage with a memory. Files decay when ignored.

A Next.js SaaS where uploaded files slowly decay and auto-delete if not accessed. Users renew files they care about — everything else disappears.

---

## Tech Stack

| Layer | Tool | Cost at MVP |
|---|---|---|
| Framework | Next.js 14 (App Router) | Free |
| Auth | Clerk | Free tier |
| Database | Neon (serverless Postgres) | Free tier |
| Storage | Cloudflare R2 | ~$0.015/GB/mo, **zero egress** |
| Billing | Stripe | 2.9% + 30¢ per transaction |
| Email | Resend | Free up to 3,000/mo |
| Hosting + Cron | Vercel | Free tier |

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

**Clerk** (https://dashboard.clerk.com)
- Create a new app
- Copy publishable key and secret key
- Set redirect URLs to match your `.env.local`

**Neon** (https://neon.tech)
- Create a new project
- Copy the connection string

**Cloudflare R2** (https://dash.cloudflare.com)
- Create an R2 bucket named `decaystore-files`
- Create an API token with R2 read/write permissions
- Note your Account ID

**Stripe** (https://dashboard.stripe.com)
- Create two products: "Starter" ($5/mo) and "Pro" ($15/mo)
- Copy the price IDs into `.env.local`
- Set up a webhook endpoint pointing to `/api/webhooks/stripe`
- Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

**Resend** (https://resend.com)
- Create an account and verify your domain
- Create an API key

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
│   │   ├── cron/decay/     # Nightly decay runner
│   │   ├── files/          # File CRUD + presigned URLs
│   │   ├── stripe/         # Checkout + portal
│   │   └── webhooks/       # Stripe webhook handler
│   ├── auth/               # Sign-in / sign-up pages
│   ├── dashboard/          # Main app view
│   ├── pricing/            # Pricing page
│   └── page.tsx            # Landing page
├── components/
│   └── dashboard/
│       ├── DashboardHeader.tsx
│       ├── FileGrid.tsx
│       ├── FileUploader.tsx
│       └── StorageBar.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts        # Neon + Drizzle connection
│   │   └── schema.ts       # Database schema
│   ├── auth-helpers.ts     # Clerk → DB user sync
│   ├── decay.ts            # Core decay engine
│   ├── email.ts            # Resend email templates
│   ├── r2.ts               # Cloudflare R2 client
│   ├── stripe.ts           # Stripe client + plans
│   └── utils.ts            # Shared utilities
└── middleware.ts            # Route protection
```

---

## Decay Logic

The core logic lives in `src/lib/decay.ts`:

```
decay_score = days_since_last_access / decay_rate_days

0.0  → Fresh (just uploaded or accessed)
0.5  → Warning email sent
0.75 → Compressed / second warning
0.9  → Critical / final warning
1.0  → Permanently deleted from R2
```

The cron job at `/api/cron/decay` runs nightly at 2AM UTC (configured in `vercel.json`).

---

## Decay Rates by Plan

| Plan | Decay Window | Storage |
|---|---|---|
| Free | 14 days | 1 GB |
| Starter ($5/mo) | 30 days | 25 GB |
| Pro ($15/mo) | 90 days | 100 GB |

---

## Deployment

### Vercel

```bash
npm install -g vercel
vercel
```

Set all environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

The cron job is automatically configured via `vercel.json`. Vercel will call `/api/cron/decay` with the `Authorization: Bearer <CRON_SECRET>` header each night.

### Manual cron (alternative)

If not using Vercel, trigger the decay endpoint with:

```bash
curl -X GET https://yourdomain.com/api/cron/decay \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Local Development Notes

- Uploads go directly to R2 via presigned URLs (client → R2, no server bandwidth used)
- The cron endpoint can be triggered manually during development
- Use `npm run db:studio` to inspect your database visually

---

## License

MIT
