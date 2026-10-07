# Incident response runbook (Plan 26)

Applies to any suspected exposure of personal information (tenant/landlord names, SSN last-4,
license numbers, addresses, signatures, payment data) or leaked credentials.

## First hour
1. **Contain.** Rotate the exposed secret (Supabase service role / JWT secret, Stripe, Resend,
   Twilio, CRON_SECRET) and redeploy on Vercel. Revoke sessions in Supabase Auth if user
   accounts may be compromised.
2. **Preserve evidence.** Export Supabase logs (API, Auth, Postgres) and Vercel runtime logs for
   the window in question before they age out.
3. **Open an incident note** (date, who found it, what is known, actions taken, times).

## Within 24–72 hours
4. **Scope.** Identify which tables/rows/files were reachable and which users are affected.
5. **Decide whether notification is required.** Puerto Rico Ley 111-2005 covers a name plus
   SSN, license/ID, bank or card numbers, passwords, medical or tax information.

## Notification (Ley 111-2005)
6. Notify the **Departamento de Asuntos del Consumidor (DACO)** within **10 days** of detecting
   the breach. DACO publishes notice within 24 hours of receipt.
7. Notify affected individuals as expeditiously as possible (email, plus public notice if
   contact data is insufficient). Describe what happened, what data, what we did, and a
   contact (hola@prcontract.online).
8. If Stripe card data could be involved, follow Stripe's incident guidance.

## After
9. Root-cause write-up, fixes merged with tests, and update this runbook.

> Pending review by a Puerto Rico attorney before launch.
