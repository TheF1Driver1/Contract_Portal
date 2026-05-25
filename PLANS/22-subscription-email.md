# Plan 22 — Subscription Activation Email

## Problem
When a user subscribes (Stripe webhook fires `customer.subscription.created`), the app silently updates `profiles.plan` in Supabase but sends no confirmation to the user. The user has no receipt, no welcome message, and no guidance on what their new plan unlocks.

## Goal
Send a transactional email via Resend immediately after the webhook successfully upgrades a user's plan, confirming the subscription and highlighting the key features they've unlocked.

---

## Scope

### 1 — Email in the webhook handler
In `web/app/api/webhooks/stripe/route.ts`, after the successful `profiles.update({ plan })` call, fire a Resend email to the user's email address.

The user's email is not in the subscription metadata. Resolution:
1. After updating `profiles`, query `auth.users` via the admin client to get the email for `owner_id`.
2. Send the email.

```ts
// After profiles.update({ plan })
const { data: authUser } = await supabase.auth.admin.getUserById(ownerId);
if (authUser?.user?.email) {
  await sendSubscriptionEmail(authUser.user.email, plan);
}
```

### 2 — Email template (`lib/emails/subscription-activated.ts`)
HTML email (inline styles, Resend-compatible):
- Subject: `Tu suscripción a ContractOS está activa · Your ContractOS subscription is active`
- Body:
  - Plan name + price
  - 3 bullet highlights for the specific plan (propietario vs inversionista)
  - CTA button → `${APP_URL}/settings/billing`
  - Footer with cancel/manage link

### 3 — Plan-specific copy
| Plan | Bullets |
|---|---|
| propietario | Hasta 5 propiedades · SMS delivery · Expense export CSV |
| inversionista | Propiedades ilimitadas · Schedule E report · Up to 3 managers |

### 4 — Cancellation email
On `customer.subscription.deleted`, send a brief "Your subscription has been cancelled" email with a link to resubscribe at `/pricing`.

---

## Files to touch
| File | Change |
|---|---|
| `web/app/api/webhooks/stripe/route.ts` | Call email function after plan update |
| `web/lib/emails/subscription-activated.ts` | New — HTML email builder for activation |
| `web/lib/emails/subscription-cancelled.ts` | New — HTML email builder for cancellation |

---

## Resend setup
- Already configured (`RESEND_API_KEY`, `FROM_EMAIL=noreply@prcontract.online`)
- No new env vars needed
- Use the existing send pattern from `web/app/api/contracts/[id]/send-email/route.ts`

---

## Acceptance criteria
- [ ] Subscribing to Propietario sends a confirmation email within 30s of webhook
- [ ] Subscribing to Inversionista sends the correct plan-specific bullets
- [ ] Email subject is bilingual (ES/EN)
- [ ] CTA links to `/settings/billing`
- [ ] Cancellation sends a brief farewell email with `/pricing` link
- [ ] No email sent if `auth.admin.getUserById` fails (silent fail, log error)
- [ ] Webhook still returns `{ received: true }` even if email send fails

---

## Effort estimate
~2 hours (webhook edit + 2 email templates)
