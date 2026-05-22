export async function sendTwilioSms(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) throw new Error("Twilio env vars not configured");

  const twilio = (await import("twilio")).default;
  const client = twilio(sid, token);
  await client.messages.create({ body, from, to });
}

export async function sendResendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from   = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("[resend] Send error:", error);
    throw new Error(error.message);
  }
}

export async function sendTenantInviteEmail(
  to: string,
  tenantName: string,
  propertyName: string,
  inviteUrl: string,
  landlordName: string
): Promise<void> {
  const greeting = tenantName ? `Hello ${tenantName},` : "Hello,";
  const subject = `Sign your lease for ${propertyName}`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#111;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:0.04em;">LEASE AGREEMENT — SIGNATURE REQUIRED</p>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#222;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
            ${landlordName ? `<strong>${landlordName}</strong> has sent you a lease agreement for <strong>${propertyName}</strong> that requires your signature.` : `A lease agreement for <strong>${propertyName}</strong> has been sent to you for signature.`}
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
            Click the button below to review and sign your lease. You will be asked to create a secure account to access the document.
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          <a href="${inviteUrl}" style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
            Review &amp; Sign Lease
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
            This link expires in 7 days. If you did not expect this email, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  await sendResendEmail(to, subject, html);
}

export function buildExpiryNotification(opts: {
  tenantName: string;
  propertyName: string;
  daysLeft: number;
  contractUrl: string;
}): { sms: string; subject: string; emailHtml: string } {
  const { tenantName, propertyName, daysLeft, contractUrl } = opts;
  const daysLabel = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  const tenantLabel = tenantName ? ` (${tenantName})` : "";

  const sms = `Reminder: Your lease for ${propertyName}${tenantLabel} expires in ${daysLabel}. View contract: ${contractUrl}`;

  const subject = `Lease Expiring in ${daysLabel} — ${propertyName}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:0.04em;">LEASE EXPIRY REMINDER</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 16px;font-size:15px;color:#222;">Hello,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
              The lease for <strong>${propertyName}</strong>${tenantLabel} expires in <strong>${daysLabel}</strong>.
              You may want to reach out to renew or let it expire.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px;">
            <a href="${contractUrl}"
               style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:600;">
              View Contract
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
              This is an automated expiry reminder. To stop receiving these alerts for this contract, open the contract and toggle off notifications.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { sms, subject, emailHtml };
}
