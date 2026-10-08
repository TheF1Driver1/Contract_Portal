/** Reads what the year-end package needs, scoped to one owner. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrimBill, Database, Payment, PropertyCrim, TaxResidency } from "@/lib/db";
import { buildAnnualPackage, type AnnualPackage, type TaxView } from "@/lib/tax/annual";

type Client = SupabaseClient<Database>;

export const viewFor = (residency: TaxResidency | null | undefined): TaxView => (residency === "non_resident" ? "schedule_e" : "anejo_n");

export async function getTaxResidency(supabase: Client, userId: string): Promise<TaxResidency | null> {
  const { data } = await supabase.from("profiles").select("tax_residency").eq("id", userId).maybeSingle();
  const v = (data as { tax_residency?: string | null } | null)?.tax_residency;
  return v === "pr_resident" || v === "non_resident" ? v : null;
}

/**
 * Ledger income (cash received, not voided) per property for a year, and the
 * properties that have at least one lease with a rent ledger.
 */
export async function ledgerIncomeByProperty(
  supabase: Client,
  userId: string,
  year: number
): Promise<{ income: Map<string, number>; ledgerContracts: Map<string, string> }> {
  const { data: ledgers } = await supabase.from("rent_ledgers").select("contract_id").eq("owner_id", userId);
  const ids = (ledgers ?? []).map((l) => l.contract_id);
  const income = new Map<string, number>();
  const ledgerContracts = new Map<string, string>();
  if (!ids.length) return { income, ledgerContracts };
  const [{ data: contracts }, { data: payments }] = await Promise.all([
    supabase.from("contracts").select("id, property_id").in("id", ids),
    supabase
      .from("payments")
      .select("contract_id, amount, voided_at")
      .in("contract_id", ids)
      .gte("received_on", `${year}-01-01`)
      .lte("received_on", `${year}-12-31`),
  ]);
  for (const c of contracts ?? []) ledgerContracts.set(c.id, c.property_id);
  for (const p of payments ?? []) {
    if (p.voided_at) continue;
    const prop = ledgerContracts.get(p.contract_id);
    if (prop) income.set(prop, Math.round(((income.get(prop) ?? 0) + Number(p.amount)) * 100) / 100);
  }
  return { income, ledgerContracts };
}

export async function loadAnnualPackage(supabase: Client, userId: string, year: number, propertyId?: string | null): Promise<AnnualPackage> {
  let propsQ = supabase.from("properties").select("id, name, address, city").eq("owner_id", userId).order("name");
  if (propertyId) propsQ = propsQ.eq("id", propertyId);
  const { data: properties } = await propsQ;
  const pids = (properties ?? []).map((p) => p.id);
  if (!pids.length) return buildAnnualPackage({ year, properties: [], contracts: [], ledgerContractIds: [], payments: [], expenses: [], crimBills: [], taxInputs: [] });

  const [{ data: contracts }, { data: expenses }, { data: bills }, { data: crim }] = await Promise.all([
    supabase.from("contracts").select("id, property_id, status, rent_amount, lease_start, lease_end").eq("owner_id", userId).in("property_id", pids),
    supabase
      .from("property_expenses")
      .select("property_id, category, amount, expense_date")
      .eq("user_id", userId)
      .in("property_id", pids)
      .gte("expense_date", `${year}-01-01`)
      .lte("expense_date", `${year}-12-31`),
    supabase.from("crim_bills").select("*").eq("owner_id", userId).in("property_id", pids),
    supabase.from("property_crim").select("*").eq("owner_id", userId).in("property_id", pids),
  ]);
  const cids = (contracts ?? []).map((c) => c.id);
  const [{ data: ledgers }, { data: payments }] = cids.length
    ? await Promise.all([
        supabase.from("rent_ledgers").select("contract_id").in("contract_id", cids),
        supabase
          .from("payments")
          .select("contract_id, amount, received_on, voided_at")
          .in("contract_id", cids)
          .gte("received_on", `${year}-01-01`)
          .lte("received_on", `${year}-12-31`),
      ])
    : [{ data: [] }, { data: [] }];

  return buildAnnualPackage({
    year,
    properties: properties ?? [],
    contracts: (contracts ?? []).map((c) => ({ ...c, rent_amount: Number(c.rent_amount) })),
    ledgerContractIds: (ledgers ?? []).map((l) => l.contract_id),
    payments: ((payments ?? []) as Pick<Payment, "contract_id" | "amount" | "received_on" | "voided_at">[]).map((p) => ({ ...p, amount: Number(p.amount) })),
    expenses: (expenses ?? []).map((e) => ({ ...e, amount: Number(e.amount) })),
    crimBills: ((bills ?? []) as CrimBill[]).map((b) => ({ ...b, amount: Number(b.amount) })),
    taxInputs: (crim ?? []) as PropertyCrim[],
  });
}
