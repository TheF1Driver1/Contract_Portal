import type { TablesUpdate } from "@/lib/database.types";
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { appUrl } from "@/lib/app-url";
import { logEvent, maybeSeal, requestMeta } from "@/lib/esign/service";
import { rateLimitWrite } from "@/lib/rate-limit";
import { ContractSignatureSchema, ContractSignatureDeleteSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// The landlord's own signature. Tenants sign through the verified e-sign flow
// (/sign/[token]), including in person on the landlord's device (Plan 31).
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
  if (role !== "landlord") {
    return NextResponse.json(
      { error: "El inquilino firma con un código de verificación. Usa «Firmar en persona» en la sección de firmas." },
      { status: 410 }
    );
  }

  const { data, error } = await supabase
    .from("contracts")
    .update({ landlord_signature: signature })
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    const signed = error.message.includes("signed_contract_immutable");
    return NextResponse.json(
      { error: signed ? "Un contrato firmado no se puede modificar." : "No se pudo guardar la firma." },
      { status: signed ? 409 : 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Landlord signing may be the last step: seal if every tenant already signed.
  const admin = createAdminClient();
  await logEvent(admin, { contractId: params.id, event: "landlord_signed", actor: user.email ?? null, meta: requestMeta(req) }).catch((e) =>
    console.error(JSON.stringify({ level: "error", msg: "landlord_signed event failed", contract: params.id, err: String(e) }))
  );
  const sealed = await maybeSeal(admin, params.id, appUrl(req)).catch((e) => {
    console.error(JSON.stringify({ level: "error", msg: "seal after landlord signature failed", contract: params.id, err: String(e) }));
    return false;
  });

  return NextResponse.json({ success: true, sealed });
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
  if (contract.status === "signed") {
    return NextResponse.json(
      { error: "Un contrato firmado no se puede modificar. Usa «Anular y reemitir»." },
      { status: 409 }
    );
  }

  const update: TablesUpdate<"contracts"> =
    parsed.data.role === "landlord" ? { landlord_signature: null } : { tenant_signature: null, signed_at: null };

  const { error } = await supabase
    .from("contracts")
    .update(update)
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: "Failed to remove signature" }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
