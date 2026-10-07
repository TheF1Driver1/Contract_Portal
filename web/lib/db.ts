// Database type used by every Supabase client. database.types.ts is generated
// from production; PendingTables covers tables created by migrations that are
// applied at merge (012, 013, 018). Regenerate and delete entries once applied.
import type { Database as Generated } from "@/lib/database.types";

type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

type InvestmentAnalysis = {
  id: string;
  owner_id: string;
  watchlist_id: string;
  purchase_price: number;
  down_payment_pct: number;
  closing_cost_pct: number;
  mortgage_rate_pct: number;
  loan_term_years: number;
  annual_tax_pct: number;
  annual_insurance_pct: number;
  maintenance_pct: number;
  monthly_hoa: number;
  monthly_utilities: number;
  estimated_rent: number | null;
  vacancy_rate_pct: number;
  created_at: string | null;
  updated_at: string | null;
};

type PendingTables = {
  investment_analyses: Table<
    InvestmentAnalysis,
    Partial<InvestmentAnalysis> & Pick<InvestmentAnalysis, "owner_id" | "watchlist_id" | "purchase_price">
  >;
  cron_runs: Table<
    { id: number; job: string; started_at: string; finished_at: string; ok: boolean; summary: Generated["public"]["Tables"]["contracts"]["Row"]["amenities"] },
    { job: string; started_at: string; finished_at: string; ok: boolean; summary?: unknown }
  >;
  stripe_events: Table<{ id: string; type: string; processed_at: string }, { id: string; type: string }>;
  plan_entitlements: Table<{
    plan: string;
    max_properties: number | null;
    max_contracts_per_month: number | null;
    sms: boolean;
    market: boolean;
    templates: boolean;
    expense_export: boolean;
    schedule_e: boolean;
    managers: number | null;
  }>;
};

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables"> & {
    Tables: Generated["public"]["Tables"] & PendingTables;
  };
};

export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
