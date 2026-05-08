import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { SendContractSchema } from "@/lib/schemas";
import { buildPdfHtml } from "@/lib/pdf-template";
import { renderPdfFromHtml } from "@/lib/render-pdf";
import type { Contract, Profile } from "@/lib/types";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = SendContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contractId, landlordEmail, phone } = parsed.data;

  // Full contract fetch including snapshots and all joined relations
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, property:properties(*), tenant:tenants(*), pdf_url")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Fetch landlord profile for the document header
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const contractUrl = `${appUrl}/contracts/${contractId}`;
  const results: Record<string, unknown> = {};

  // ── Build PDF attachment ──────────────────────────────────────────────────
  // Always PDF — documents sent via email must not be editable by the recipient.
  let pdfBuffer: Buffer | null = null;

  // 1. Try to use the already-stored PDF (generated when user clicked Send)
  const storedPdfUrl = (contract as Contract & { pdf_url?: string | null }).pdf_url;
  if (storedPdfUrl) {
    try {
      const res = await fetch(storedPdfUrl);
      if (res.ok) pdfBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // fall through to fresh generation
    }
  }

  // 2. If no stored PDF, generate fresh from the programmatic template
  if (!pdfBuffer) {
    const html = buildPdfHtml(contract as Contract, profile as Profile | null);
    pdfBuffer = await renderPdfFromHtml(html);
  }

  const attachments: { filename: string; content: Buffer }[] =
    pdfBuffer ? [{ filename: `lease_agreement_${contractId}.pdf`, content: pdfBuffer }] : [];

  if (!pdfBuffer) {
    console.error("[send] PDF generation failed — sending email without attachment");
  }

  // ── EMAIL via Resend ──────────────────────────────────────────────────────
  if (landlordEmail) {
    if (!process.env.RESEND_API_KEY) {
      results.email = "skipped: RESEND_API_KEY not configured";
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from   = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

        const propertyName = (contract.property as { name?: string } | null)?.name ?? "your property";
        const tenantName   = (contract.tenant  as { full_name?: string; email?: string } | null)?.full_name ?? "";
        const tenantEmail  = (contract.tenant  as { full_name?: string; email?: string } | null)?.email?.trim() ?? "";

        const subject = `Lease Agreement — ${propertyName}`;

        const sends: Promise<unknown>[] = [
          resend.emails.send({
            from,
            to: landlordEmail,
            subject,
            html: emailHtml({
              greeting: "Hello,",
              body: `Please find the executed lease agreement for <strong>${propertyName}</strong> attached to this email as a PDF.`,
              contractUrl,
              hasAttachment: attachments.length > 0,
            }),
            attachments,
          }),
        ];

        if (tenantEmail) {
          sends.push(
            resend.emails.send({
              from,
              to: tenantEmail,
              subject,
              html: emailHtml({
                greeting: `Hello${tenantName ? ` ${tenantName}` : ""},`,
                body: `Your lease agreement for <strong>${propertyName}</strong> is attached to this email as a PDF. Please retain this document for your records.`,
                contractUrl,
                hasAttachment: attachments.length > 0,
              }),
              attachments,
            })
          );
        }

        const sendResults = await Promise.allSettled(sends);
        const failed = sendResults.filter((r) => r.status === "rejected");
        if (failed.length) {
          const reasons = failed.map((r) => (r as PromiseRejectedResult).reason?.message ?? String(r));
          console.error("[send] Resend errors:", reasons);
          results.email = `partial failure: ${reasons.join("; ")}`;
        } else {
          results.email = "sent";
        }
      } catch (e) {
        console.error("[send] email error:", e);
        results.email = "failed: " + (e as Error).message;
      }
    }
  }

  // ── SMS via Twilio ─────────────────────────────────────────────────────────
  if (phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const tenantName = (contract.tenant as { full_name?: string } | null)?.full_name ?? "";
      const propertyName = (contract.property as { name?: string } | null)?.name ?? "your property";

      await client.messages.create({
        body: `Hi${tenantName ? ` ${tenantName}` : ""}, your lease agreement for ${propertyName} has been sent to your email. View it here: ${contractUrl}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phone,
      });
      results.sms = "sent";
    } catch (e) {
      results.sms = "failed: " + (e as Error).message;
    }
  }

  await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", contractId);

  return NextResponse.json({ success: true, results });
}

// ── Email HTML builder ─────────────────────────────────────────────────────
function emailHtml({
  greeting,
  body,
  contractUrl,
  hasAttachment,
}: {
  greeting: string;
  body: string;
  contractUrl: string;
  hasAttachment: boolean;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#111;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:0.04em;">LEASE AGREEMENT</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 16px;font-size:15px;color:#222;">${greeting}</p>
            <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">${body}</p>
            ${hasAttachment
              ? `<p style="margin:0 0 16px;font-size:13px;color:#666;">The signed PDF is attached to this email.</p>`
              : `<p style="margin:0 0 16px;font-size:13px;color:#cc4400;">Note: The PDF attachment could not be generated at this time. Please use the link below to view the contract online.</p>`
            }
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px;">
            <a href="${contractUrl}"
               style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:600;">
              View Contract Online
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
              This is an automated message. The attached PDF is the official executed agreement and should not be altered.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
