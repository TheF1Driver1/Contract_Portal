import { NextResponse } from "next/server";
import { tenantHasLease } from "@/lib/maintenance/service";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { appUrl } from "@/lib/app-url";
import { reissueLink } from "@/lib/esign/service";
import { signErrorResponse } from "@/lib/esign/http";

/**
 * Tenant portal hand-off to the verified signing ceremony (Plan 31). A tenant
 * with a redeemed invite gets a fresh signing link for their own signer row.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!(await tenantHasLease(admin, user.id, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: signer } = await admin
    .from("contract_signers")
    .select("id, owner_id, status")
    .eq("contract_id", id)
    // Case-insensitive exact match: escape LIKE wildcards in the address.
    .ilike("email", user.email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .in("status", ["pending", "viewed"])
    .order("sign_order")
    .limit(1)
    .maybeSingle();
  if (!signer) {
    return NextResponse.json(
      { error: "Todavía no hay una solicitud de firma para ti. Pide al arrendador que envíe el contrato para firma." },
      { status: 409 }
    );
  }
  try {
    const { url } = await reissueLink(admin, { signerId: signer.id, ownerId: signer.owner_id, appUrl: appUrl(req), inPerson: false, notify: false });
    return NextResponse.json({ url });
  } catch (e) {
    return signErrorResponse(e);
  }
}
