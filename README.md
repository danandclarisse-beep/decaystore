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
- **Rate limiter is per-instance:** The in-memory rate limiter does not share state across Vercel function instances. For production scale, replace with Upstash Redis.

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

### Phase 4 — Security Hardening ✅
*All 8 findings from Beta 4 security audit resolved*

- **[S1] Timing-safe webhook HMAC** — `verifyLemonSqueezyWebhook` now uses `timingSafeEqual` on `Buffer` digests, closing the timing-oracle attack vector on LemonSqueezy webhook signature verification.
- **[S2] HTTP security headers** — `next.config.js` now emits `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a full `Content-Security-Policy` on every response.
- **[S3] Rate limiting** — New `src/lib/rate-limit.ts` provides a sliding-window counter. Applied to `POST /api/files` (20 req/min) and `POST /api/stripe/checkout` (5 req/min); returns `429` with `Retry-After` header.
- **[S4] MIME type allowlist** — `POST /api/files` now validates `contentType` against a server-side `ALLOWED_MIME_TYPES` Set (~35 permitted types) before generating a presigned URL. Unsupported types are rejected with `415`.
- **[S5] Removed oversized body limit** — `serverActions.bodySizeLimit: '100mb'` removed from `next.config.js`; uploads bypass the server entirely via presigned URLs so the default 1 MB limit is correct.
- **[S6] Uniform Zod validation** — `POST /api/folders`, `PATCH /api/files/[id]/rename`, and `POST /api/files` now parse request bodies through Zod schemas, matching the existing pattern in `POST /api/stripe/checkout`.
- **[S7] ESM-safe crypto import** — `require("crypto")` inside `verifyLemonSqueezyWebhook` replaced with a top-of-file `import { createHmac, timingSafeEqual } from "crypto"`.
- **[S8] Cron route defence documented** — Inline comment in `middleware.ts` explains the two-layer model (public Clerk route + bearer token) and links to Vercel firewall docs for operators who want IP allowlisting.

### Beta 8 — Notification System + Mobile UX ✅
*New in Beta 8*

- **[B8-1] Notification system** — New `useNotifications` hook derives persistent notifications from live file/user data (decay alerts, storage warnings, file-limit warnings). Supports auto-dismiss toasts via `pushToast`, per-notification dismissal persisted to `localStorage`, and unread badge count reflected in the browser tab title.
- **[B8-2] `NotificationBell` component** — Header bell (desktop, `lg+`) with dropdown panel, and a floating action button (mobile, `< lg`) that opens a centered overlay modal. Unread badge, critical-state pulsing animation, and Escape-key dismissal all supported.
- **[B8-3] `NotificationPanel` component** — Severity-coded notification list (critical / warning / info / success) with per-item dismiss, clear-all, action buttons (Renew, Upgrade), and an empty state.
- **[B8-4] Mobile notification modal fix** — The float-variant panel was previously anchored `bottom-14 right-0` relative to the FAB, causing it to render off-screen or clipped on small viewports. Replaced with a full-screen overlay (`fixed inset-0 z-[130]`) with a centered, max-width-400 panel and a blurred backdrop. Tapping the backdrop closes the modal; tapping inside the panel does not.
- **[B8-5] Dashboard wiring** — `DashboardHeader` and `DashboardPage` pass all notification props through; the mobile FAB is rendered at the root of `DashboardPage` so it sits above all content at `z-[120]`.

---

## Security Audit — Beta 8 (March 2026) ✅ ALL FINDINGS CLOSED

### Overall Score: 96 / 100 — **Production Ready** 🚀

Full re-audit against OWASP Top 10 (2021), OWASP API Security Top 10, OWASP MASVS (mobile/client-side), and general SaaS hardening benchmarks. Covers the new notification system surface area introduced in Beta 8.

---

### Score Breakdown

| Category | Weight | Score | Notes |
|---|---|---|---|
| Authentication & Session Management | 20% | 20/20 | Clerk enforced on all protected routes; middleware matcher correct; no regressions |
| Authorization / IDOR Prevention | 20% | 20/20 | Every DB query scoped to `user.id`; notification data is derived client-side from already-authorized file/user state |
| Input Validation & Injection Prevention | 15% | 14/15 | Zod uniform across all mutation endpoints; MIME allowlist enforced; notification hook does no I/O so no new surface |
| Secrets & Credential Hygiene | 15% | 15/15 | Timing-safe HMAC; ESM-safe crypto import; all secrets in env vars; no new secrets introduced by notification system |
| Security Headers & Transport | 10% | 10/10 | Full header suite carried forward: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Webhook & External Integration Security | 10% | 10/10 | `timingSafeEqual` in place; LemonSqueezy webhook handler unchanged and correct |
| Rate Limiting & Abuse Prevention | 5% | 4/5 | Sliding-window limiter on upload + checkout; in-memory (single instance); notification endpoints are read-only with no new abuse surface |
| Client-side Storage & Data Exposure | 5% | 3/5 | `localStorage` used to persist dismissed notification IDs — see B8-N1; `sessionStorage` for ephemeral toasts — see B8-N2 |

**Total: 96 / 100**

*(The 4-point residual: 1pt for in-memory rate limiter scope; 2pts for client-side storage findings; 1pt for minor Zod gap. All accepted for MVP.)*

---

### Beta 8 Audit — New Findings

#### 🟡 [B8-N1] Medium — `localStorage` dismissed-ID list off-by-one in cap enforcement
**File:** `src/hooks/useNotifications.ts` — `addDismissed()`

`slice(-200)` runs after the new entry is pushed, meaning the list can temporarily hold 201 items before being trimmed. The data is non-sensitive (deterministic notification ID strings only), but on highly constrained devices persistent writes could trigger `QuotaExceededError` in extreme edge cases. Cap enforcement before the push would be more correct.

**Status:** Accepted for MVP — cardinality of dismissible notification types is small (single digits), making 201-item overflow practically impossible.

---

#### 🟢 [B8-N2] Low — `sessionStorage` toast persistence leaks across cloned tabs
**File:** `src/hooks/useNotifications.ts` — `getSessionNotifs()` / `setSessionNotifs()`

`sessionStorage` is tab-scoped but browsers that clone sessions (e.g. "Duplicate Tab") share the session storage. A dismissed success toast from tab A can briefly re-appear in tab B. Not a security issue. Toasts with `autoDismissMs` and severity `success` are already excluded from `sessionStorage`.

**Status:** Acceptable as-is for MVP.

---

#### 🟢 [B8-N3] Low — Notification action callbacks susceptible to stale closures if `useCallback` removed
**File:** `src/hooks/useNotifications.ts` — `deriveFromData`; `src/app/dashboard/page.tsx`

Action callbacks (`onRenewFile`, `onNavigatePricing`) are captured at hook creation. Both are currently stable `useCallback` references in `DashboardPage`, so this is not a live bug. If either is ever refactored without `useCallback`, silent stale-closure issues could emerge.

**Recommendation:** Add a `// keep stable — captured as callback in useNotifications` comment on both `useCallback` wrappers in `DashboardPage`.

---

#### 🟢 [B8-N4] Low — Mobile notification modal lacks focus trap (accessibility gap)
**File:** `src/components/dashboard/NotificationBell.tsx`

The centered mobile modal does not implement a focus trap. Keyboard users on mobile can tab focus behind the backdrop. This is a WCAG 2.1 SC 2.1.2 gap, not a security issue.

**Recommendation:** Add `inert` to sibling DOM nodes on modal open, or integrate a lightweight focus-trap library. Defer to a dedicated accessibility pass.

---

#### ✅ [B8-N5] Info — No new API routes introduced by notification system
The notification system is entirely client-side. `useNotifications` derives state from already-fetched and already-authorized file/user data. Zero new API surface, zero new auth boundaries, zero new DB queries. Confirmed: no new IDOR, injection, or rate-limit exposure.

---

### All Prior Findings — Status as of Beta 8

| ID | Severity | Issue | Status |
|---|---|---|---|
| S1 | 🔴 High | Webhook HMAC used `===` instead of `timingSafeEqual` | ✅ Closed |
| S2 | 🔴 High | No HTTP security headers | ✅ Closed |
| S3 | 🟡 Medium | No rate limiting on upload or checkout endpoints | ✅ Closed |
| S4 | 🟡 Medium | MIME type not validated server-side | ✅ Closed |
| S5 | 🟡 Medium | `serverActions.bodySizeLimit: '100mb'` unnecessarily large | ✅ Closed |
| S6 | 🟢 Low | Zod not used uniformly across API routes | ✅ Closed |
| S7 | 🟢 Low | `require("crypto")` inside function (CommonJS anti-pattern) | ✅ Closed |
| S8 | 🟢 Low | Cron route documented; IP allowlist guidance added | ✅ Closed |
| B8-N1 | 🟡 Medium | `localStorage` dismissed-ID cap off-by-one | Accepted / MVP |
| B8-N2 | 🟢 Low | `sessionStorage` toast leaks to cloned tabs | Accepted / MVP |
| B8-N3 | 🟢 Low | Stale-closure risk on notification callbacks | Doc fix recommended |
| B8-N4 | 🟢 Low | Mobile modal missing focus trap | Deferred |
| B8-N5 | ℹ️ Info | No new API surface from notification system | ✅ Confirmed clean |

---

### Frontend Audit — Beta 8

#### Component Architecture

| Component | Finding | Result |
|---|---|---|
| `useNotifications.ts` | Derives from already-authorized data only — no new fetch surface | ✅ Clean |
| `useNotifications.ts` | `localStorage` cap off-by-one (B8-N1) | 🟡 Accepted |
| `useNotifications.ts` | `sessionStorage` cloned-tab leak (B8-N2) | 🟢 Accepted |
| `useNotifications.ts` | Stale-closure risk on callbacks (B8-N3) | 🟢 Doc fix |
| `NotificationBell.tsx` | Mobile modal fixed: centered overlay replaces anchored dropdown | ✅ Fixed |
| `NotificationBell.tsx` | FAB at `z-[120]`, modal overlay at `z-[130]` — stacking correct | ✅ Clean |
| `NotificationBell.tsx` | Focus trap missing on mobile modal (B8-N4) | 🟢 Deferred |
| `NotificationPanel.tsx` | Outside-click uses `mousedown` — correct; touch events not covered | 🟢 Acceptable |
| `NotificationPanel.tsx` | `onMarkAllRead` fires on mount — correct intent, no perf concern | ✅ Clean |
| `DashboardHeader.tsx` | Bell hidden mobile (`hidden lg:block`); mobile uses FAB — correct split | ✅ Clean |
| `DashboardPage.tsx` | `renewFileRef` avoids stale closure on renew handler — correct | ✅ Clean |

#### Performance

| Area | Finding | Impact |
|---|---|---|
| `deriveFromData` recompute | Wrapped in `useCallback` with correct deps — React memoizes | ✅ Fine |
| `localStorage` reads | Only on dismiss user action, not on render | ✅ Fine |
| `sessionStorage` reads | Inside `useEffect`, not during render | ✅ Fine |
| `document.title` update | `useEffect` on `unreadCount` change only | ✅ Fine |

#### Accessibility

| Area | Finding | WCAG | Priority |
|---|---|---|---|
| Mobile modal | No focus trap | 2.1.2 | Post-MVP |
| Dismiss button | `aria-label="Dismiss"` present | 4.1.2 | ✅ Pass |
| Bell button | `aria-label` with unread count | 4.1.2 | ✅ Pass |
| Severity icons | Decorative — no `aria-hidden` | 1.1.1 | Minor gap |

---

### Remaining Known Limitations (Non-Security)

- **No DB transactions:** The `neon-http` driver does not support transactions. Storage counters use atomic SQL increments — not fully ACID. Switch to `neon-serverless` for full transaction support if needed.
- **Cron scale:** The nightly decay cron processes all files in memory. At very high file counts this may approach Vercel's 60s function timeout. Cursor-based pagination is planned.
- **Orphan guard on failed upload:** If a browser upload to R2 fails mid-transfer, a DB record exists without an R2 object. A future cleanup sweep will handle stale unconfirmed records.
- **Rate limiter is per-instance:** The in-memory rate limiter does not share state across Vercel function instances. For production scale, replace with Upstash Redis.

---

## Legal

- [Privacy Policy](/legal/privacy)
- [Terms of Service](/legal/terms)
- [Cookie Policy](/legal/cookies)

Contact: legal@decaystore.com

---

## License

MIT

---

## Beta 9 — Live Decay Timer + File Details ✅

### Changes

- **[B9-1] Live decay score computed client-side** — Previously `FileGrid` rendered `file.decayScore` from the database, which is only updated by the nightly cron job. A file uploaded 10 hours ago would show "14d left" because the DB score was still `0`. Now every card computes `liveDecayScore = calculateDecayScore(lastAccessedAt, decayRateDays)` directly in the browser using the same formula as the server, so the timer is always accurate to the minute.
- **[B9-2] `formatRelativeTime` upgraded to sub-day resolution** — Previously floored to whole days ("Today" for anything < 24h). Now shows minutes (`5m ago`), hours (`3h ago`), days (`2d ago`), weeks, months, and years — matching industry standard relative timestamps.
- **[B9-3] `formatDateTime` added to `utils.ts`** — Full date + time formatter (`Mar 28, 2026, 4:32 PM`) used in the Details panel.
- **[B9-4] File Details modal** — New "Details" option added to every file's `⋯` overflow menu. Opens a modal showing: file name, size, MIME type, version, status badge, uploaded date/time, last accessed date/time, warned-at date (if applicable), decay rate, live decay score %, time remaining, visibility, description, and file ID. Includes a live decay bar and quick Renew + Download actions in the footer.

### Files changed

| File | Route |
|---|---|
| `FileGrid.tsx` | `src/components/dashboard/FileGrid.tsx` |
| `utils.ts` | `src/lib/utils.ts` |