import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { canExportExpenses } from "@/lib/subscription";
import type { Property, SubscriptionPlan } from "@/lib/types";
import ExpensesClient, { type ExpenseRow } from "@/components/expenses/ExpensesClient";

interface PageProps {
  searchParams: Promise<{ year?: string; new?: string }>;
}

export default async function ExpensesPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = Number.isFinite(requested) && requested >= 2000 && requested <= 2099 ? requested : currentYear;
  if (!years.includes(year)) years.push(year);

  const [{ data: properties }, { data: expenses }, { data: profile }] = await Promise.all([
    supabase.from("properties").select("id, name").eq("owner_id", user.id).order("name"),
    supabase
      .from("property_expenses")
      .select("*, property:properties(id,name)")
      .eq("user_id", user.id)
      .gte("expense_date", `${year}-01-01`)
      .lte("expense_date", `${year}-12-31`)
      .order("expense_date", { ascending: false }),
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
  ]);

  const plan = (profile?.plan ?? "free") as SubscriptionPlan;

  return (
    <ExpensesClient
      expenses={(expenses ?? []) as ExpenseRow[]}
      properties={(properties ?? []) as Pick<Property, "id" | "name">[]}
      year={year}
      years={years.sort((a, b) => b - a)}
      canExport={canExportExpenses(plan)}
      openNew={searchParams.new === "1"}
    />
  );
}
