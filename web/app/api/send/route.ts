import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { SendContractSchema } from "@/lib/schemas";
import { fetchTemplate, renderDocx } from "@/lib/generate-docx";
import type { Contract } from "@/lib/types";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const body = await req.json();
  const parsed = SendContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contractId, landlordEmail, phone } = parsed.data;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, tenant:tenants(full_name, email), property:properties(name)")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const contractUrl = `${appUrl}/contracts/${contractId}`;
  const results: Record<string, unknown> = {};

  // === EMAIL via Resend ===
  if (landlordEmail) {
    if (!process.env.RESEND_API_KEY) {
      results.email = "skipped: RESEND_API_KEY not configured in this environment";
    } else {
      try {
        // Generate DOCX attachment directly (no HTTP — avoids auth issue)
        let attachments: { filename: string; content: Buffer }[] = [];
        try {
          const fallbackUrl = `${appUrl}/templates/contract_template.docx`;
          const templateBuffer = await fetchTemplate(
            supabase,
            user.id,
            contract.contract_type,
            (contract as Contract & { template_id?: string | null }).template_id ?? null,
            fallbackUrl
          );
          if (templateBuffer.length) {
            const docxBuffer = renderDocx(templateBuffer, contract as Contract);
            attachments = [{ filename: `contract_${contractId}.docx`, content: docxBuffer }];
          }
        } catch (attachErr) {
          console.error("[send] attachment generation failed:", attachErr);
        }

        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const subject = `Lease Agreement — ${contract.property?.name}`;
        const html = `
          <p>Hello,</p>
          <p>Please find attached the lease agreement for <strong>${contract.property?.name}</strong>.</p>
          <p><a href="${contractUrl}">View Contract Online</a></p>
        `;

        const sends: Promise<unknown>[] = [];
        sends.push(resend.emails.send({
          from: process.env.FROM_EMAIL ?? "onboarding@resend.dev",
          to: landlordEmail,
          subject,
          html,
          attachments,
        }));

        const tenantEmail = (contract.tenant as { full_name: string; email?: string } | null)?.email?.trim();
        if (tenantEmail) {
          sends.push(resend.emails.send({
            from: process.env.FROM_EMAIL ?? "onboarding@resend.dev",
            to: tenantEmail,
            subject,
            html: `
              <p>Hello ${(contract.tenant as { full_name: string })?.full_name},</p>
              <p>Please review and sign your lease agreement for <strong>${contract.property?.name}</strong>.</p>
              <p><a href="${contractUrl}">View Contract Online</a></p>
              ${attachments.length ? "<p>The contract is also attached to this email.</p>" : ""}
            `,
            attachments,
          }));
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

  // === SMS via Twilio ===
  if (phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      await client.messages.create({
        body: `Hi ${contract.tenant?.full_name}, your lease agreement for ${contract.property?.name} is ready. Review it here: ${contractUrl}`,
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
