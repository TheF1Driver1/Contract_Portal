import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase-server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Agreement content (terms, clauses) can change only on a draft, or on a sent
 * contract with no open signature request. Returns an error response, or null.
 */
export async function lockedAgreementResponse(supabase: Client, contractId: string): Promise<NextResponse | null> {
  const { data: contract } = await supabase.from("contracts").select("status").eq("id", contractId).maybeSingle();
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status === "signed" || contract.status === "cancelled" || contract.status === "expired") {
    return NextResponse.json({ error: "Un contrato firmado o anulado no se puede modificar. Usa «Anular y reemitir»." }, { status: 409 });
  }
  const { count } = await supabase
    .from("contract_signers")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId)
    .in("status", ["pending", "viewed", "signed"]);
  if (count) {
    return NextResponse.json({ error: "Este contrato tiene una solicitud de firma abierta. Cancélala para editarlo." }, { status: 409 });
  }
  return null;
}
