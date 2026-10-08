import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { receiptFor } from "@/lib/rent/receipt-data";
import { receiptNumber, renderReceipt } from "@/lib/rent/receipt";

export const dynamic = "force-dynamic";

// Tenant download: only for leases this tenant redeemed an invite for.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("contract_id, voided_at").eq("id", id).maybeSingle();
  if (!payment || payment.voided_at) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: invite } = await admin
    .from("tenant_invites")
    .select("id")
    .eq("contract_id", payment.contract_id)
    .eq("used_by", user.id)
    .eq("used", true)
    .limit(1)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = await receiptFor(admin, id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderReceipt(r.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptNumber(r.data.number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
