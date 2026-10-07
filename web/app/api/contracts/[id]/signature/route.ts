import type { TablesUpdate } from "@/lib/database.types";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { rateLimitWrite } from "@/lib/rate-limit";
import { ContractSignatureSchema, ContractSignatureDeleteSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Landlord-side signature capture. The landlord signs for themselves, or hands
// their device to the tenant to sign in person. A tenant signature marks the
// contract signed, mirroring app/api/portal/contracts/[id]/sign/route.ts.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = ContractSignatureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { role, signature } = parsed.data;
  const update =
    role === "landlord"
      ? { landlord_signature: signature }
      : { tenant_signature: signature, signed_at: new Date().toISOString(), status: "signed" as const };

  const { data, error } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitWrite(user.id);
  if (limited) return limited;

  const role = new URL(req.url).searchParams.get("role");
  const parsed = ContractSignatureDeleteSchema.safeParse({ role });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Removing the tenant signature un-signs the contract so it can be re-signed.
  const update: TablesUpdate<"contracts"> =
    parsed.data.role === "landlord"
      ? { landlord_signature: null }
      : {
          tenant_signature: null,
          signed_at: null,
          ...(contract.status === "signed" ? { status: "sent" as const } : {}),
        };

  const { error } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: "Failed to remove signature" }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
