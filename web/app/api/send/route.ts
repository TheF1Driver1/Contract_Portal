import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contractId, landlordEmail, phone } = await req.json();

  // Verify ownership
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, tenant:tenants(full_name, email), property:properties(name)")
    .eq("id", contractId)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const contractUrl = `${appUrl}/contracts/${contractId}`;
  const results: Record<string, unknown> = {};

  // === EMAIL via Resend ===
  if (landlordEmail && process.env.RESEND_API_KEY) {
    try {
      // Generate document
      const docRes = await fetch(`${appUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const attachments =
        docRes.ok
          ? [
              {
                filename: `contract_${contractId}.docx`,
                content: Buffer.from(await docRes.arrayBuffer()),
              },
            ]
          : [];

      const subject = `Lease Agreement — ${contract.property?.name}`;
      const html = `
        <p>Hello,</p>
        <p>Please find attached the lease agreement for <strong>${contract.property?.name}</strong>.</p>
        <p><a href="${contractUrl}">View Contract</a></p>
      `;

      const sends: Promise<unknown>[] = [];
      sends.push(resend.emails.send({
        from: process.env.FROM_EMAIL ?? "contracts@yourdomain.com",
        to: landlordEmail,
        subject,
        html,
        attachments,
      }));

      const tenantEmail = (contract.tenant as { full_name: string; email?: string } | null)?.email;
      if (tenantEmail) {
        sends.push(resend.emails.send({
          from: process.env.FROM_EMAIL ?? "contracts@yourdomain.com",
          to: tenantEmail,
          subject,
          html: `
            <p>Hello ${(contract.tenant as { full_name: string })?.full_name},</p>
            <p>Please review and sign your lease agreement for <strong>${contract.property?.name}</strong>.</p>
            <p><a href="${contractUrl}">View Contract</a></p>
            <p>The contract is also attached to this email.</p>
          `,
          attachments,
        }));
      }

      await Promise.all(sends);
      results.email = "sent";
    } catch (e) {
      results.email = "failed: " + (e as Error).message;
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

  // Mark as sent
  await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", contractId);

  return NextResponse.json({ success: true, results });
}
