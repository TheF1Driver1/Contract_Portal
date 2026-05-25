# Plan 20 — Stripe Live Mode Setup & dev → main Merge

**Branch:** `main` (no code changes — env vars + Stripe dashboard config only)

---

## Prerequisites

All code is already complete and deployed to Vercel preview. This plan covers:
1. Verifying your Stripe account so live mode is unlocked
2. Creating live products/prices
3. Registering a live webhook
4. Swapping env vars in Vercel production
5. Merging `dev` → `main`

---

## Step 1 — Verify your Stripe account

Stripe requires identity/business verification before live mode payments can process.

1. Go to [https://dashboard.stripe.com/settings/business](https://dashboard.stripe.com/settings/business)
2. Complete every section marked with a warning banner:
   - **Business type** — Individual or LLC/Corp
   - **Business address** — must be a real address
   - **Business website** — use `https://contract-portal-six.vercel.app`
   - **Product description** — e.g. "SaaS platform for rental contract management"
   - **SSN (last 4) or EIN** — for tax identity
   - **Bank account** — for payouts (routing + account number)
3. Submit. Stripe typically activates within minutes to 1 business day.
4. You'll receive an email when live mode is fully enabled.

---

## Step 2 — Create live products & prices

Do this after receiving Stripe's activation email.

1. Switch to **Live mode** (toggle in the top-left of the Stripe dashboard)
2. Go to **Products → Add product**

### Propietario
- Name: `Propietario`
- Price: `$29.00 / month` (recurring, monthly)
- Copy the resulting **Price ID** → this becomes `STRIPE_PRICE_PROPIETARIO`

### Inversionista
- Name: `Inversionista`
- Price: `$99.00 / month` (recurring, monthly)
- Copy the resulting **Price ID** → this becomes `STRIPE_PRICE_INVERSIONISTA`

---

## Step 3 — Activate Customer Portal (live mode)

1. Go to **Settings → Billing → Customer portal**
2. Enable the portal, configure allowed actions (cancel, update payment method)
3. Click **Save** and then **Copy link**
4. This URL becomes `STRIPE_CUSTOMER_PORTAL_URL`

---

## Step 4 — Register the live webhook

1. Go to **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://contract-portal-six.vercel.app/api/webhooks/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**
5. Click **Reveal** under "Signing secret" → copy the `whsec_...` value → this becomes `STRIPE_WEBHOOK_SECRET`

---

## Step 5 — Swap Stripe env vars in Vercel production

Go to the Vercel dashboard → Project **contract-portal** → Settings → Environment Variables.

Replace these 5 variables in the **Production** environment:

| Variable | Where to find the live value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (live mode) |
| `STRIPE_WEBHOOK_SECRET` | Step 4 above |
| `STRIPE_PRICE_PROPIETARIO` | Step 2 above |
| `STRIPE_PRICE_INVERSIONISTA` | Step 2 above |
| `STRIPE_CUSTOMER_PORTAL_URL` | Step 3 above |

Also add `PUBLISHABLE_KEY` (live publishable key) if used client-side.

After updating all vars, trigger a **Redeploy** (no code changes needed — Vercel re-reads env at build time).

---

## Step 6 — Smoke test in production

After the redeploy completes:

1. Go to `https://contract-portal-six.vercel.app/pricing`
2. Sign in with a real (non-test) account
3. Click **Propietario** → confirm Stripe Checkout loads in live mode (no "TEST MODE" banner)
4. Complete a real $29 purchase with a real card
5. Verify `profiles.plan` flips to `'propietario'` in Supabase
6. Go to Billing → "Manage Subscription" → confirm Customer Portal opens

---

## Step 7 — PR dev → main

Once live mode is confirmed working:

1. Open a PR from `dev` → `main` on GitHub
2. Title: `chore: merge dev → main (pr-expansion + stripe live)`
3. The PR includes: Ley 14 compliance features, pricing/billing, property manager invitations, i18n infrastructure, Schedule E, market/watchlist
4. Merge (squash or merge commit — your preference)
5. Vercel auto-deploys `main` → `https://contract-portal-six.vercel.app`

---

## Test accounts to create (live mode)

After going live, create test user accounts under real emails to verify the full subscription flow end-to-end.

---

## What is NOT in this plan (separate branches/plans)

- **Plan 18** (`feature/i18n-strings`): Extract hardcoded strings into `t()` calls across all components
- **Plan 19** (`feature/ley14-system-template`): Upload attorney-reviewed Ley 14 .docx template when available
