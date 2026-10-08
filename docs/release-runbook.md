# Release runbook: `feature/roadmap-execution` → `dev` → `main`

This branch carries Plans 24–32. The code expects database migrations 012–021,
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
- [ ] **Storage**: confirm that `signed-documents` exists and is **private**.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

New or changed on this branch. `web/.env.example` has the full list.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Links in emails and SMS, signing links, sitemap | Example: `https://prcontract.online` |
| `CRON_SECRET` | `/api/cron/notify`, `/api/cron/lifecycle` | Both routes fail closed when it is unset |
| `UNSUBSCRIBE_SECRET` | Unsubscribe links in onboarding emails | Falls back to `CRON_SECRET`. Set it separately so `CRON_SECRET` can be rotated without breaking old links |
| `STRIPE_PRICE_ENTERPRISE`, `STRIPE_PRICE_PROPIETARIO_YEARLY`, `STRIPE_PRICE_INVERSIONISTA_YEARLY` | Pricing page and checkout | Create these prices in Stripe first |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Without them the limiter is in-memory and per-instance only |
| `FROM_EMAIL` | All email | Must be on a domain verified in Resend (SPF, DKIM, DMARC) |

Cron jobs (`web/vercel.json`) are created automatically on deploy:
`/api/cron/notify` runs daily at 10:00 UTC, and `/api/cron/lifecycle` runs daily
at 14:00 UTC (10:00 AST).

## 4. Deploy

1. Merge the PR into `dev`. Check the preview deployment against the preview database or a Supabase branch.
2. Apply §1 to production, and do §2 and §3.
3. Merge `dev` into `main`.

## 5. Smoke test in production (about 15 minutes)

- [ ] `/`, `/pricing`, `/en`, `/terminos` and `/privacidad` load. `/sitemap.xml` and `/robots.txt` respond.
- [ ] Sign up a new landlord with the consent box checked. The welcome email arrives the next day at 10:00 AST; you can also trigger it right away with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/lifecycle`.
- [ ] Use the getting-started checklist: import one property and one tenant from CSV, then create a contract.
- [ ] **Request a signature.** Open the link on a phone, give consent, enter the code (SMS or email), sign, then sign as the landlord. The contract becomes `signed`, the sealed PDF downloads, and the certificate shows the SHA-256 hashes.
- [ ] Try to edit the signed contract. It is blocked; use **Void and reissue**.
- [ ] Stripe test-mode checkout, then the customer portal. The webhook is recorded once in `stripe_events`.
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
- [ ] **iOS (Plan 38)**: move signing to the web flow before 020 reaches production.
