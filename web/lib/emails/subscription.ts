import { sendResendEmail } from "@/lib/notify";
import type { SubscriptionPlan } from "@/lib/types";

// ponytail: activation + cancellation share one module — split if templates diverge

const PLAN_COPY: Record<string, { name: string; price: string; bullets: string[] }> = {
  propietario: {
    name: "Propietario",
    price: "$29/mes",
    bullets: [
      "Hasta 5 propiedades · Up to 5 properties",
      "Envío de contratos por SMS · SMS contract delivery",
      "Exportación de gastos a CSV · Expense export CSV",
    ],
  },
  inversionista: {
    name: "Inversionista",
    price: "$99/mes",
    bullets: [
      "Propiedades ilimitadas · Unlimited properties",
      "Reporte Schedule E (IRS) · Schedule E report",
      "Hasta 3 administradores · Up to 3 property managers",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: "",
    bullets: [
      "Propiedades ilimitadas · Unlimited properties",
      "Administradores ilimitados · Unlimited managers",
      "Soporte prioritario · Priority support",
    ],
  },
};

function emailShell(headline: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#111;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:0.04em;">${headline}</p>
        </td></tr>
        ${bodyRows}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendSubscriptionActivatedEmail(
  to: string,
  plan: SubscriptionPlan,
  appUrl: string
): Promise<void> {
  const copy = PLAN_COPY[plan];
  if (!copy) return; // free / unknown plan — nothing to announce

  const subject =
    "Tu suscripción a ContractOS está activa · Your ContractOS subscription is active";
  const bullets = copy.bullets
    .map(
      (b) =>
        `<li style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.6;">${b}</li>`
    )
    .join("");
  const html = emailShell(
    "SUSCRIPCIÓN ACTIVA — SUBSCRIPTION ACTIVE",
    `<tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#222;">¡Gracias! · Thank you!</p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
            Tu plan <strong>${copy.name}</strong>${copy.price ? ` (${copy.price})` : ""} está activo. Esto es lo que acabas de desbloquear · Your plan is now active. Here's what you unlocked:
          </p>
          <ul style="margin:0 0 16px;padding-left:20px;">${bullets}</ul>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          <a href="${appUrl}/settings/billing" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
            Administrar suscripción · Manage subscription
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
            Puedes cancelar o cambiar tu plan en cualquier momento desde Facturación · You can cancel or change your plan anytime from Billing.
          </p>
        </td></tr>`
  );
  await sendResendEmail(to, subject, html);
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  appUrl: string
): Promise<void> {
  const subject =
    "Tu suscripción a ContractOS fue cancelada · Your ContractOS subscription was cancelled";
  const html = emailShell(
    "SUSCRIPCIÓN CANCELADA — SUBSCRIPTION CANCELLED",
    `<tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#222;">Hola · Hello,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
            Tu suscripción fue cancelada y tu cuenta pasó al plan gratuito. Tus datos permanecen intactos · Your subscription was cancelled and your account is now on the free plan. Your data remains intact.
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          <a href="${appUrl}/pricing" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
            Reactivar plan · Resubscribe
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
            Si esto fue un error, puedes reactivar tu plan en cualquier momento · If this was a mistake, you can resubscribe anytime.
          </p>
        </td></tr>`
  );
  await sendResendEmail(to, subject, html);
}
