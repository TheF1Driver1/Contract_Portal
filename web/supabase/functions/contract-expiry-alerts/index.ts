import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Scheduled daily at 8am via Supabase cron: 0 8 * * *
// Checks contracts expiring in 60, 30, and 14 days.
// Sends email via Resend, logs to contract_alerts to prevent duplicates.

const ALERT_WINDOWS = [
  { days: 60, type: "expiry_60" as const },
  { days: 30, type: "expiry_30" as const },
  { days: 14, type: "expiry_14" as const },
];

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response("RESEND_API_KEY not set", { status: 500 });
  }

  const now = new Date();
  let alertsSent = 0;

  for (const { days, type } of ALERT_WINDOWS) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const targetStr = targetDate.toISOString().slice(0, 10);

    // Find signed contracts expiring on targetDate with no existing alert of this type
    const { data: contracts, error } = await supabase
      .from("contracts")
      .select("id, owner_id, lease_end, rent_amount, property:properties(name, address, city), tenant:tenants(full_name, email), profiles!contracts_owner_id_fkey(email, full_name)")
      .eq("status", "signed")
      .eq("lease_end", targetStr);

    if (error || !contracts?.length) continue;

    for (const c of contracts) {
      // Check if alert already sent
      const { data: existing } = await supabase
        .from("contract_alerts")
        .select("id")
        .eq("contract_id", c.id)
        .eq("alert_type", type)
        .maybeSingle();

      if (existing) continue;

      const ownerEmail = (c as any).profiles?.email;
      const ownerName = (c as any).profiles?.full_name ?? "Landlord";
      const tenantName = (c as any).tenant?.full_name ?? "your tenant";
      const propertyName = (c as any).property?.name ?? "your property";
      const propertyCity = (c as any).property?.city ?? "";

      if (!ownerEmail) continue;

      // Send email via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ContractOS <noreply@contractos.app>",
          to: [ownerEmail],
          subject: `Lease expiring in ${days} days — ${propertyName}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; color: #0a0f1c;">Lease Expiring Soon</h2>
              <p style="color: #6b7280; margin: 0 0 24px; font-size: 15px;">Hi ${ownerName},</p>
              <p style="color: #374151; font-size: 15px;">
                The lease for <strong>${tenantName}</strong> at <strong>${propertyName}${propertyCity ? `, ${propertyCity}` : ""}</strong>
                expires on <strong>${c.lease_end}</strong> — that's <strong>${days} days</strong> from today.
              </p>
              <p style="color: #374151; font-size: 15px; margin-top: 16px;">
                Log in to ContractOS to send a renewal contract.
              </p>
              <a href="${Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://contractos.app"}/contracts/${c.id}"
                 style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #007aff; color: white; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View Contract
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">ContractOS · You're receiving this because you have an active lease expiring soon.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        console.error(`Failed to send alert email for contract ${c.id}:`, await emailRes.text());
        continue;
      }

      // Log alert to prevent re-send
      await supabase.from("contract_alerts").insert({
        contract_id: c.id,
        owner_id: c.owner_id,
        alert_type: type,
      });

      alertsSent++;
    }
  }

  return new Response(JSON.stringify({ alertsSent }), {
    headers: { "Content-Type": "application/json" },
  });
});
