import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { SendAdHocEmailSchema } from "@/lib/schemas";
import { renderContractPdf } from "@/lib/pdf-react";
import type { Contract, Profile } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = SendAdHocEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { landlordEmail, tenantEmail } = parsed.data;

  const [{ data: contract, error }, { data: profile }, { data: sectionsData }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, property:properties(*), tenant:tenants(*)")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("contract_custom_sections")
      .select("title, body")
      .eq("contract_id", params.id)
      .eq("owner_id", user.id)
      .order("order_index", { ascending: true }),
  ]);

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const sections = (sectionsData ?? []) as { title: string; body: string }[];
  const pdfBuffer = await renderContractPdf(contract as Contract, profile as Profile | null, sections);
  const attachments = pdfBuffer
    ? [{ filename: `lease_agreement_${params.id}.pdf`, content: pdfBuffer }]
    : [];

  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const contractUrl = `${appUrl}/contracts/${params.id}`;

  const propertyName = (contract.property as { name?: string } | null)?.name ?? "your property";
  const tenantName   = (contract.tenant  as { full_name?: string } | null)?.full_name ?? "";
  const subject = `Lease Agreement — ${propertyName}`;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

  type ResendResult = { data: unknown; error: { message: string; name?: string } | null };
  const sends: Promise<ResendResult>[] = [];

  console.log(`[send-email] contract=${params.id} from=${from} landlord=${landlordEmail ?? "none"} tenant=${tenantEmail ?? "none"}`);

  if (landlordEmail) {
    sends.push(resend.emails.send({
      from,
      to: landlordEmail,
      subject,
      html: buildEmailHtml({
        greeting: "Hello,",
        body: `Please find the lease agreement for <strong>${propertyName}</strong> attached to this email as a PDF.`,
        contractUrl,
        hasAttachment: attachments.length > 0,
      }),
      attachments,
    }) as Promise<ResendResult>);
  }

  if (tenantEmail) {
    sends.push(resend.emails.send({
      from,
      to: tenantEmail,
      subject,
      html: buildEmailHtml({
        greeting: `Hello${tenantName ? ` ${tenantName}` : ""},`,
        body: `Your lease agreement for <strong>${propertyName}</strong> is attached. Please retain this document for your records.`,
        contractUrl,
        hasAttachment: attachments.length > 0,
      }),
      attachments,
    }) as Promise<ResendResult>);
  }

  const results = await Promise.allSettled(sends);
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      errors.push((r.reason as Error)?.message ?? String(r.reason));
    } else if (r.value.error) {
      errors.push(r.value.error.message ?? "Resend error");
    }
  }
  if (errors.length) {
    console.error(`[send-email] FAILED contract=${params.id}:`, errors);
    return NextResponse.json({ success: false, error: errors.join("; ") }, { status: 500 });
  }

  console.log(`[send-email] SUCCESS contract=${params.id}`);
  return NextResponse.json({ success: true });
}

function buildEmailHtml({
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
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#111;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:0.04em;">LEASE AGREEMENT</p>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#222;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">${body}</p>
          ${hasAttachment
            ? `<p style="margin:0 0 16px;font-size:13px;color:#666;">The PDF is attached to this email.</p>`
            : `<p style="margin:0 0 16px;font-size:13px;color:#cc4400;">Note: PDF could not be generated. Use the link below.</p>`
          }
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          <a href="${contractUrl}" style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:600;">
            View Contract Online
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;line-height:1.5;">
            This is an automated message. The attached PDF is the official executed agreement.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
