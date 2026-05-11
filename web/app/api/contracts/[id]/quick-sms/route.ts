import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitStrict } from "@/lib/rate-limit";
import { sendTwilioSms, buildExpiryNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitStrict(user.id);
  if (limited) return limited;

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, tenant:tenants(full_name, phone), property:properties(name)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const tenant = contract.tenant as { full_name?: string; phone?: string | null } | null;
  const phone = tenant?.phone ?? null;

  if (!phone) {
    return NextResponse.json(
      { error: "Tenant has no phone number on file" },
      { status: 400 }
    );
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`;
  const contractUrl = `${appUrl}/contracts/${params.id}`;

  const propertyName = (contract.property as { name?: string } | null)?.name ?? "your property";
  const tenantName   = tenant?.full_name ?? "";

  const { sms } = buildExpiryNotification({
    tenantName,
    propertyName,
    daysLeft: 0,
    contractUrl,
  });

  // Override the expiry message — this is a manual contract send, not an expiry alert
  const smsBody = `Hi${tenantName ? ` ${tenantName}` : ""}, your lease agreement for ${propertyName} is ready. View it here: ${contractUrl}`;

  let sendError: string | null = null;
  try {
    await sendTwilioSms(phone, smsBody);
  } catch (e) {
    sendError = (e as Error).message;
  }

  // Log the send attempt
  await supabase.from("contract_notification_logs").insert({
    contract_id:   params.id,
    owner_id:      user.id,
    trigger_id:    null,
    days_before:   0,
    channel:       "sms",
    status:        sendError ? "failed" : "sent",
    error_message: sendError,
  });

  if (sendError) {
    return NextResponse.json({ error: sendError }, { status: 500 });
  }

  return NextResponse.json({ success: true, phone });
}
