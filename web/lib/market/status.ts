import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db";

/**
 * Latest successful Zillow scrape, from the market_data_updated_at() RPC
 * (migration 026). Null when the RPC is missing or no run has succeeded yet;
 * the UI then simply omits the "updated" line.
 */
export async function getMarketDataUpdatedAt(supabase: SupabaseClient<Database>): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("market_data_updated_at");
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}
