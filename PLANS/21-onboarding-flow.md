# Plan 21 — New User Onboarding Flow

## Problem
Free users who sign up land on `/dashboard` with an empty state and no guidance. There is no prompt to add a property, create a contract, or understand what the product does. First-run conversion (free → active user) is low because the app silently waits.

## Goal
Guide a brand-new user from signup → first property → first contract in under 3 minutes, using a lightweight checklist/banner approach that disappears once complete.

---

## Scope

### 1 — Empty state on Dashboard
When `propertyCount === 0 && contractCount === 0`, show a welcome card instead of blank space:
- Headline: "Bienvenido a ContractOS — Let's get started"
- Three step tiles (numbered): Add a property → Create a contract → Invite your tenant
- Each tile links to the relevant page
- Dismissable once all three are done (stored in `profiles.onboarding_dismissed`)

### 2 — DB column
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean NOT NULL DEFAULT false;
```
Migration file: `web/supabase/migrations/011_onboarding.sql`

### 3 — Empty states on sub-pages
If `propertyCount === 0` on `/contracts/new`, show a callout: "First, add a property" with a link to `/properties/new`.

### 4 — First-property prompt after signup
After `supabase.auth.signUp()` succeeds in the signup form, redirect to `/properties/new?onboarding=1` instead of `/dashboard`. The properties form already exists; no new UI needed.

---

## Files to touch
| File | Change |
|---|---|
| `web/supabase/migrations/011_onboarding.sql` | New — add `onboarding_dismissed` column |
| `web/app/(dashboard)/dashboard/page.tsx` | Detect empty state, render welcome card |
| `web/components/OnboardingBanner.tsx` | New — the 3-step checklist card component |
| `web/app/(auth)/signup/page.tsx` | Change post-signup redirect to `/properties/new?onboarding=1` |
| `web/app/(dashboard)/contracts/page.tsx` | Add "add a property first" callout when propertyCount = 0 |

---

## Empty-state card design
```
┌──────────────────────────────────────────────────────┐
│  👋 Bienvenido a ContractOS                          │
│  Set up your first rental in 3 steps                 │
│                                                      │
│  [ 1 ] Add a property          →  /properties/new   │
│  [ 2 ] Create your first contract → /contracts/new  │
│  [ 3 ] Send it to your tenant  →  (after step 2)    │
└──────────────────────────────────────────────────────┘
```
Each step gets a green checkmark once the resource exists. Step 3 activates only after a contract exists.

---

## Acceptance criteria
- [ ] Brand-new user (zero properties, zero contracts) sees the welcome card on dashboard
- [ ] After adding a property the first tile shows a checkmark
- [ ] After creating a contract the second tile shows a checkmark
- [ ] Banner can be dismissed; dismissal persists across sessions
- [ ] Users with existing data never see the banner
- [ ] Signup redirects new users to `/properties/new?onboarding=1`

---

## Effort estimate
~3–4 hours (DB migration + 2 new components + 3 small page edits)
