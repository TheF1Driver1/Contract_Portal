# Release runbook: `feature/roadmap-execution` → `dev` → `main`

This branch carries Plans 24–40. The code expects database migrations 012–033,
which are **not** in production yet (011 was applied on 2026-10-07). Deploy in
the order below. Steps 1–3 can run before the code ships, because every migration
is additive and backward compatible with the current `main`. The exception is
020, which blocks the old in-app tenant signing (see step 1 notes).

## 0. Before you start

- [ ] CI is green on the PR (lint, i18n check, typecheck, unit tests, build, Playwright).
- [ ] Take a database backup: Supabase Dashboard → Database → Backups, or run `pg_dump`.
- [ ] Pick a low-traffic window. Migration 020 adds triggers on `contracts`.

## 1. Database migrations (Supabase SQL editor, in order)

Run each file from `web/supabase/migrations/` as its own query. All of them are
idempotent, so re-running one is safe. They have been replayed in order against
a copy of the production schema, together with role-based behavior checks.

| # | File | What it does | Notes |
|---|---|---|---|
| 012 | `012_plan_entitlements.sql` | `plan_entitlements` table and limit triggers | Enforces plan limits on direct inserts |
| 013 | `013_reliability.sql` | `cron_runs`, `stripe_events`, reminder de-duplication index | |
| 014 | `014_governing_law.sql` | Replaces Ley 14/464 references with Código Civil 2020 | |
| 015 | `015_access_token_hook.sql` | `custom_access_token_hook` (adds `app_role` and `locale` to the JWT) | Also needs the dashboard step in §2 |
| 016 | `016_check_constraints.sql` | CHECK constraints that mirror `lib/schemas.ts` | Existing rows were verified to pass |
| 017 | `017_rls_performance.sql` | `(select auth.uid())` in RLS, plus FK indexes | |
| 018 | `018_investment_analyses.sql` | Creates the table that is missing in prod | Fixes the broken investment calculator |
| 019 | `019_tenant_locale.sql` | `tenants.preferred_locale` | |
| 020 | `020_esign.sql` | E-sign tables, evidence log, signed-contract immutability, signing guard, `signed-documents` bucket, realtime | ⚠️ See below |
| 021 | `021_lifecycle_emails.sql` | `profiles.lifecycle_emails`, `lifecycle_email_log` | |
| 022 | `022_rent_ledger.sql` | `rent_ledgers`, `rent_charges`, `payments`, `contract_ledger` view | Rent tracking is opt-in per lease |
| 023 | `023_messaging.sql` | `message_log`, `messaging_consents`, `profiles.digest_emails` | WhatsApp/SMS consent and delivery tracking |
| 024 | `024_maintenance_inspections.sql` | Maintenance requests, updates and photos; move-in/move-out inspections; private `maintenance-photos` bucket | Completed inspections are frozen by a trigger |
| 025 | `025_tax_pack.sql` | `profiles.tax_residency`, `property_crim`, `crim_bills` | |
| 026 | `026_market_status.sql` | `rea.scrape_runs`, `market_data_updated_at()`, `zillow_market` view gains `rentZestimate`/`livingArea`, `zillow_historical` primary key, indexes, `unaccent` | Recreates the `zillow_market` view (columns appended, grants kept) |
| 027 | `027_ai_usage.sql` | `ai_usage_events` (per-plan monthly AI quotas) | Stores no prompt or document content |
| 028 | `028_tenant_pii_encryption.sql` | `date_of_birth_enc` on `tenants` and `contract_occupants` | Then set `FIELD_ENCRYPTION_KEY` and run the backfill (§3) |
| 029 | `029_ai_qa.sql` | Adds `qa` to the AI usage feature check | |
| 030 | `030_referrals.sql` | `referral_codes`, `referrals` | Server-only writes; self-referrals rejected |
| 031 | `031_ath_movil.sql` | `ath_movil_accounts` (encrypted tokens only), `ath_movil_payments`, `ath_movil_status()` | Needs `FIELD_ENCRYPTION_KEY` set before landlords connect |
| 032 | `032_security_hardening.sql` | Locks `tenant_invites` to server writes, adds WITH CHECK on contract children and photo/attachment paths, server-only tenant evidence | **Apply to production now, ahead of the release** (see note below) |
| 033 | `033_dashboard_summary.sql` | `dashboard_summary()` RPC with the dashboard KPIs (security invoker) | Used by the iOS app; the web keeps its own query for now |

**About 032 (urgent).** The tenant-invite and contract-children policies it
fixes are already live in production: today any signed-in user can insert a
`tenant_invites` row for another landlord's contract and read it through the
tenant portal policies. Part 1 (tenant_invites) and part 2 (contract children)
work with the app currently on `main`, because every invite write there goes
through the service role. Parts 3–4 refer to tables from 024 and must wait
until 024 is applied, so for production today apply only sections 1 and 2 of
the file (or the whole file after 024).

**About 020.** After 020, only the server (service role) can mark a contract
`signed`, write `tenant_signature` or set sealing fields. This affects two things:

- The **current `main` web app**: capturing the tenant's signature on the
  landlord's device (`POST /api/contracts/[id]/signature` with `role: tenant`)
  stops working until this branch is deployed. Portal signing already uses the
  service role and keeps working. Apply 020 in the same window as the deploy.
- The **iOS app**: any direct Supabase write that signs a contract now fails with
  `sign_via_esign`. iOS must hand signing off to the web flow (`/sign/[token]`)
  or to the API. This is tracked as Plan 38. Ship that iOS update before, or
  together with, 020.

After all migrations:

- [ ] Regenerate types: `npx supabase gen types typescript --project-id worpdncyiozjfbguxukb > web/lib/database.types.ts`.
- [ ] Delete the now-generated entries from `PendingTables`, `ContractsPatched`, `TenantsPatched` and `ProfilesPatched` in `web/lib/db.ts`, then run `tsc`.
- [ ] Run Supabase advisors (security and performance). Expect no new warnings.

## 2. Supabase dashboard settings

- [ ] **Authentication → Hooks → Customize Access Token (JWT) Claims**: enable it and select `public.custom_access_token_hook`. Without this hook the proxy falls back to a profile lookup on each request; it still works, just slower.
- [ ] **Settings → JWT Keys**: migrate to asymmetric (ECC P-256) signing keys. `getClaims()` can then verify tokens locally instead of making a network call. Leave the legacy secret active until existing sessions have expired.
- [ ] **Authentication → URL configuration**: add the production `/reset-password` and `/invite/*` URLs if they are missing.
- [ ] **Storage**: confirm that `signed-documents` exists and is **private**. New landlord signature images are stored there under `landlord-signatures/<owner>/`; the contracts row keeps a `sig:` reference. The backfill call in §3 moves existing inline images (signed contracts keep theirs).

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

New or changed on this branch. `web/.env.example` has the full list.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Links in emails and SMS, signing links, sitemap | Example: `https://prcontract.online` |
| `CRON_SECRET` | `/api/cron/notify`, `/api/cron/lifecycle` | Both routes fail closed when it is unset |
| `UNSUBSCRIBE_SECRET` | Unsubscribe links in onboarding emails | Falls back to `CRON_SECRET`. Set it separately so `CRON_SECRET` can be rotated without breaking old links |
| `STRIPE_PRICE_ENTERPRISE`, `STRIPE_PRICE_PROPIETARIO_YEARLY`, `STRIPE_PRICE_INVERSIONISTA_YEARLY` | Pricing page and checkout | Create these prices in Stripe first. The monthly/yearly toggle in Settings › Billing only appears once a yearly price is set. Also set the `yearly` amounts in `web/lib/pricing.ts` so the public pricing page shows them |
| `STRIPE_TRIAL_DAYS` | Free trial on a first paid subscription | `0` or unset means no trial; the maximum is 60. Accounts that had a subscription before never get a trial |
| `TWILIO_WHATSAPP_FROM`, `TWILIO_WA_TEMPLATE_*_ES/EN` | WhatsApp reminders and notices | Unset = WhatsApp is skipped and SMS/email is used. Templates must be approved by Meta first; the variable order is in `.env.example` |
| `RESEND_WEBHOOK_SECRET` | Delivery/open tracking (`/api/webhooks/resend`) | Create the webhook in Resend for sent, delivered, opened, bounced, complained |
| `FIELD_ENCRYPTION_KEY` (+ `FIELD_ENCRYPTION_KEY_PREVIOUS` when rotating) | Encrypts tenant license/ID numbers and birth dates | `openssl rand -base64 32`. **Keep a copy in a password manager**: losing it makes those fields unreadable. After deploying with it set, run `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/encrypt-pii` until it returns `"done": true`. Sent and signed leases keep their snapshot as signed |
| `ANTHROPIC_API_KEY` | AI receipt scanning in Expenses, lease Q&A | Unset hides every AI feature. Monthly quotas per plan are in `web/lib/ai/usage.ts` |
| `AI_LEASE_HELP` | Tenant lease Q&A on the signing page | Set to `1` only after the attorney approves a sample of answers |
| `STRIPE_REFERRAL_COUPON_ID` | Referral reward (one free month) | Optional. Create a 100%-off, duration "once" coupon in Stripe. Without it, converted referrals wait for a manual credit. Also add the **`invoice.paid`** event to the Stripe webhook endpoint, or referrals never convert |
| `CONTACT_EMAIL` | Enterprise contact form (`/contacto`) | Defaults to `hola@prcontract.online` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Without them the limiter is in-memory and per-instance only |
| `FROM_EMAIL` | All email | Must be on a domain verified in Resend (SPF, DKIM, DMARC) |

Cron jobs (`web/vercel.json`) are created automatically on deploy:
`/api/cron/rent` runs daily at 09:00 UTC (posts rent and late fees),
`/api/cron/notify` at 10:00 UTC, `/api/cron/messages` at 13:00 UTC (rent
reminders, overdue notices and the landlord digest, 9:00 AST) and
`/api/cron/lifecycle` at 14:00 UTC (10:00 AST). Each runs once a day, which fits Vercel's Hobby limits. Check
the cron count allowed on the current plan in Vercel → Settings → Cron Jobs.

Twilio console: point the number's and WhatsApp sender's "A message comes in"
webhook to `https://<app>/api/webhooks/twilio/inbound` (STOP/START/AYUDA are
handled there).

## 4. Deploy

1. Merge the PR into `dev`. Check the preview deployment against the preview database or a Supabase branch.
2. Apply §1 to production, and do §2 and §3.
3. Merge `dev` into `main`.

## 5. Smoke test in production (about 15 minutes)

- [ ] `/`, `/pricing`, `/en`, `/terminos`, `/privacidad` and `/contacto` load. Send one test inquiry from `/contacto` and confirm it arrives. `/sitemap.xml` and `/robots.txt` respond.
- [ ] Sign up a new landlord with the consent box checked. The welcome email arrives the next day at 10:00 AST; you can also trigger it right away with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/lifecycle`.
- [ ] Use the getting-started checklist: import one property and one tenant from CSV, then create a contract.
- [ ] On a signed lease, turn on **Renta y pagos**, record an ATH Móvil payment, and confirm that the tenant gets the receipt in their language. The tenant portal should show the balance.
- [ ] **Request a signature.** Open the link on a phone, give consent, enter the code (SMS or email), sign, then sign as the landlord. The contract becomes `signed`, the sealed PDF downloads, and the certificate shows the SHA-256 hashes.
- [ ] Try to edit the signed contract. It is blocked; use **Void and reissue**.
- [ ] Stripe test-mode checkout (monthly and, if configured, yearly; with a trial if `STRIPE_TRIAL_DAYS` is set), then the customer portal. The webhook is recorded once in `stripe_events`.
- [ ] Maintenance: as a tenant in `/portal`, file a repair request with a photo; the landlord gets an email and sees it in `/maintenance` and in Hoy.
- [ ] Inspections: create a move-in inspection on a signed lease, complete it, and download the PDF.
- [ ] Reports: `/reports/annual` loads for last year; CSV and PDF export work.
- [ ] Send a test text to the Twilio number with "AYUDA"; you get the bilingual help reply.
- [ ] Referrals: open `/r/<your code>` in a private window, sign up, subscribe in Stripe test mode; the referral shows as converted in Settings › Billing.
- [ ] `/socios` loads and the partner form emails `CONTACT_EMAIL`.
- [ ] Next morning, `select * from cron_runs order by started_at desc limit 5` shows `ok = true` for both jobs.

## 6. Rollback

- **Code**: promote the previous production deployment in Vercel (Deployments → ⋯ → Promote).
- **Database**: migrations are additive. To unblock the old app after 020 without restoring a backup:
  `drop trigger contracts_signing_guard on public.contracts; drop trigger occupants_signing_guard on public.contract_occupants;`
  Keep `contracts_signed_immutable` and the evidence log in place.

## 7. Outside this repo (owner actions)

- [ ] **Twilio A2P 10DLC** brand and campaign registration. US carriers block unregistered SMS. Until it is approved, signers who have an email address can choose to get the code by email.
- [ ] **Rotate the keys** that were in git history before the purge: Supabase service role, Stripe, Resend, Twilio and RapidAPI. The history rewrite does not revoke them.
- [ ] **Vercel Pro**, if you want custom analytics events (`trackEvent`). On Hobby they are dropped silently.
- [ ] **Attorney review** of `/terminos`, `/privacidad`, the lease clauses in `lib/pdf-react.tsx`, and the e-sign consent text (Ley 148-2006 / ESIGN).
- [ ] **iOS (Plan 38)**: branch `feature/esign-handoff` in Contract-Portal-iOS moves signing to the web flow. It was written without a compiler: build it in Xcode and test on a device against a backend with 020, then ship before 020 reaches production.
- [ ] **Scraper (Plan 40)**: merge `feature/market-reliability` in Real-Estate-Search-Automation after adding the Action secrets/variables (`ZILLOW_2026_API_URL`, `RESEND_API_KEY`, `ALERT_EMAIL`, `REPORT_EMAIL`, optional `MAX_PAGES`). The current workflow never passed `ZILLOW_2026_API_URL`, so past runs likely scraped nothing while showing green.
- [ ] **Revoke the Gmail app password** hardcoded in the scraper's `modules/email_integration.py` on `main` (sender jakotcontact@gmail.com). The branch removes it from the code; revoking it in the Google account is what makes it safe.
- [ ] **ATH Móvil (Plan 33)**: each landlord pastes their public token (and optionally the private token, only needed for refunds) from ATH Business → Configuración → Integración con API into Cobros → ATH Móvil Business. There is no sandbox: do a $1 payment from a tenant account first and confirm it reaches the ATH Business account and the ledger.
- [ ] **Attorney review** of the new Terms section "Programa de referidos", the AI clause-translation glossary (`web/lib/ai/glossary.ts`, then set `reviewed: true`), and notice templates before any automatic sending is added.
- [ ] **Licensing review** of Zillow data and links shown in the app (listing photos are no longer displayed).
- [ ] **CPA review** of the expense → Schedule E / Anejo N mapping (`web/lib/tax/mapping.ts`) and the year-end package.
- [ ] **AI (Plan 39)**: build the eval set (50 anonymized receipts, 20 clauses) and check receipt accuracy before announcing the feature; attorney sign-off before `AI_LEASE_HELP=1`.
