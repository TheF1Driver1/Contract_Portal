import { createClient } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import InvestmentAnalyzer from "@/components/InvestmentAnalyzer";
import type { WatchlistItem, InvestmentAnalysis } from "@/lib/types";

export default async function AnalyzePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch watchlist item + any existing analysis in parallel
  const [{ data: item }, { data: existing }] = await Promise.all([
    supabase
      .from("watchlist")
      .select("*")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("investment_analyses")
      .select("*")
      .eq("watchlist_id", params.id)
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!item) notFound();

  return (
    <InvestmentAnalyzer
      item={item as WatchlistItem}
      existing={(existing as InvestmentAnalysis | null) ?? null}
    />
  );
}
