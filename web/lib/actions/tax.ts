"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase-server";
import { CrimAccountSchema, CrimBillCreateSchema, CrimBillPaySchema, CrimBillVoidSchema, TaxResidencySchema } from "@/lib/schemas";
import { todayPR } from "@/lib/rent/service";

export type TaxActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };

const invalid = (e: z.ZodError): TaxActionResult => ({ ok: false, error: `Revisa el campo: ${String(e.issues[0]?.path.at(-1) ?? "")}.` });
const EXPIRED: TaxActionResult = { ok: false, error: "Sesión expirada. Inicia sesión de nuevo." };

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const refresh = () => {
  revalidatePath("/properties");
  revalidatePath("/reports", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
};

/** Which report is the default: Anejo N (PR resident) or Schedule E. */
export async function setTaxResidency(input: unknown): Promise<TaxActionResult> {
  const parsed = TaxResidencySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { error } = await supabase.from("profiles").update({ tax_residency: parsed.data.tax_residency }).eq("id", user.id);
  if (error) return { ok: false, error: "No se pudo guardar tu residencia contributiva." };
  revalidatePath("/reports", "layout");
  return { ok: true };
}

async function ownsProperty(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, propertyId: string) {
  const { data } = await supabase.from("properties").select("id").eq("id", propertyId).eq("owner_id", userId).maybeSingle();
  return !!data;
}

export async function saveCrimAccount(input: unknown): Promise<TaxActionResult> {
  const parsed = CrimAccountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  if (!(await ownsProperty(supabase, user.id, parsed.data.property_id))) return { ok: false, error: "Propiedad no encontrada." };
  if (parsed.data.placed_in_service && parsed.data.placed_in_service > todayPR()) {
    return { ok: false, error: "La fecha en servicio no puede ser futura." };
  }
  const { data, error } = await supabase
    .from("property_crim")
    .upsert(
      { ...parsed.data, placed_in_service: parsed.data.placed_in_service ?? null, owner_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "property_id" }
    )
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudieron guardar los datos del CRIM." };
  refresh();
  return { ok: true, id: data.id };
}

export async function addCrimBill(input: unknown): Promise<TaxActionResult> {
  const parsed = CrimBillCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  if (!(await ownsProperty(supabase, user.id, parsed.data.property_id))) return { ok: false, error: "Propiedad no encontrada." };
  const { data, error } = await supabase
    .from("crim_bills")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.code === "23505" ? "Ya registraste ese plazo para este año fiscal." : "No se pudo añadir la factura del CRIM." };
  }
  refresh();
  return { ok: true, id: data.id };
}

/** Marks a bill paid and, optionally, records it as a "Contribuciones" expense. */
export async function markCrimBillPaid(input: unknown): Promise<TaxActionResult> {
  const parsed = CrimBillPaySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { id, paid_on, payment_reference, create_expense } = parsed.data;
  if (paid_on > todayPR()) return { ok: false, error: "La fecha del pago no puede ser futura." };

  const { data: bill } = await supabase.from("crim_bills").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!bill || bill.voided_at) return { ok: false, error: "Factura no encontrada." };
  if (bill.paid_on) return { ok: false, error: "Esta factura ya está marcada como pagada." };

  let expenseId: string | null = null;
  if (create_expense) {
    const { data: expense, error } = await supabase
      .from("property_expenses")
      .insert({
        property_id: bill.property_id,
        user_id: user.id,
        category: "taxes",
        amount: Number(bill.amount),
        expense_date: paid_on,
        description: `CRIM ${bill.fiscal_year} · plazo ${bill.installment}`,
        vendor: "CRIM",
        is_tax_deductible: true,
      })
      .select("id")
      .single();
    if (error || !expense) return { ok: false, error: "No se pudo registrar el gasto." };
    expenseId = expense.id;
  }

  const { data, error } = await supabase
    .from("crim_bills")
    .update({ paid_on, payment_reference, expense_id: expenseId })
    .eq("id", id)
    .is("paid_on", null)
    .is("voided_at", null)
    .select("id");
  if (error || !data?.length) {
    // Undo the expense so it isn't counted without a paid bill.
    if (expenseId) await supabase.from("property_expenses").delete().eq("id", expenseId);
    return { ok: false, error: "No se pudo marcar como pagada." };
  }
  refresh();
  return { ok: true, id };
}

export async function voidCrimBill(input: unknown): Promise<TaxActionResult> {
  const parsed = CrimBillVoidSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = await session();
  if (!user) return EXPIRED;
  const { data, error } = await supabase
    .from("crim_bills")
    .update({ voided_at: new Date().toISOString(), void_reason: parsed.data.reason })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .is("voided_at", null)
    .select("id, expense_id");
  if (error || !data?.length) return { ok: false, error: "No se pudo anular." };
  refresh();
  return {
    ok: true,
    warning: data[0].expense_id ? "Factura anulada. El gasto que creaste sigue en Gastos; bórralo allí si no aplica." : undefined,
  };
}
