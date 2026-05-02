# Plan 16 — Email + PDF/DOCX Gap Execution

## Status
Code is complete on `dev`. Gaps are env config + live testing only.

---

## Gap 1: Resend Email Credentials

### What's broken
`.env.local` has placeholder values:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
FROM_EMAIL=contracts@yourdomain.com
```

### Steps

**A. Get API key**
1. Sign up / log in at resend.com
2. API Keys → Create API key → copy value
3. Set in `.env.local`: `RESEND_API_KEY=re_<your_key>`

**B. Set FROM_EMAIL**

Option 1 — Dev/testing (no domain needed):
```
FROM_EMAIL=onboarding@resend.dev
```
Resend allows sending from this address in dev. Recipient must be your own verified email.

Option 2 — Production (full deliverability):
1. Resend → Domains → Add Domain
2. Add DNS TXT + MX records your registrar
3. Wait for verification (minutes to hours)
4. Set `FROM_EMAIL=contracts@yourdomain.com`

**C. Verify it works**
1. `npm run dev`
2. Create contract → assign tenant with email → Step 4 → Send
3. Both landlord and tenant inboxes should receive email with `.docx` attached
4. Check `results.email` in response — should be `"sent"` not `"failed: ..."`

---

## Gap 2: PDF Download — Live Test

### What's built
- `ContractPDF.tsx` renders: tenant name, property name, rent, lease dates, status
- Button in `ContractBuilder.tsx` Step 4 area
- Button in `ContractActions.tsx` on contract detail page

### Steps
1. `npm run dev`
2. Open existing completed contract → detail page
3. Click **PDF** button → confirm `.pdf` downloads
4. Open PDF → confirm fields populated (not blank/undefined)
5. Also test from ContractBuilder → Step 4 → PDF button

### Known risk
`@react-pdf/renderer` renders client-side only — dynamic import guards are in place. If you see SSR errors, check that `pdf()` call is inside `async function` with dynamic import (already done).

---

## Gap 3: DOCX Download — Live + Vercel Test

### What's built
- `/api/generate` endpoint fills `.docx` template
- `next.config.mjs` has `outputFileTracingIncludes` so Vercel bundles `./templates/**`
- Download button in ContractBuilder + ContractActions

### Steps (local)
1. `npm run dev`
2. Open contract → click **DOCX** button → confirm download
3. Open `.docx` → confirm template variables filled correctly

### Steps (Vercel)
1. Push `dev` to origin → deploy preview or production
2. Repeat DOCX download on deployed URL
3. If 500 error: check Vercel function logs → likely template not found
4. Fix: confirm template file lives at `web/templates/` and `outputFileTracingIncludes` path matches

---

## Gap 4: Production ENV vars

When deploying to Vercel, add these in Vercel Dashboard → Project Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | `re_<your_key>` |
| `FROM_EMAIL` | `contracts@yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | `https://your-production-url.vercel.app` |
| `TWILIO_ACCOUNT_SID` | (optional, SMS) |
| `TWILIO_AUTH_TOKEN` | (optional, SMS) |
| `TWILIO_PHONE_NUMBER` | (optional, SMS) |

---

## Execution Order
1. Set Resend API key in `.env.local`
2. Test email locally (use `onboarding@resend.dev` as FROM for speed)
3. Test PDF download locally
4. Test DOCX download locally
5. Push → deploy → retest DOCX on Vercel (PDF is client-side, no Vercel risk)
6. Add production env vars to Vercel
7. Verify domain in Resend for production FROM_EMAIL
