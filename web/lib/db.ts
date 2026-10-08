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

type ContractSigner = {
  id: string;
  contract_id: string;
  owner_id: string;
  role: "tenant" | "co_tenant" | "guarantor";
  name: string;
  email: string | null;
  phone: string | null;
  locale: string;
  sign_order: number;
  status: "pending" | "viewed" | "signed" | "declined" | "revoked";
  token_hash: string;
  token_expires_at: string;
  otp_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  otp_channel: "sms" | "email" | null;
  verified_at: string | null;
  consented_at: string | null;
  signed_at: string | null;
  signature_path: string | null;
  declined_reason: string | null;
  in_person: boolean;
  created_at: string;
};

type SignatureEvent = {
  id: number;
  contract_id: string;
  signer_id: string | null;
  event: string;
  actor: string | null;
  ip: string | null;
  user_agent: string | null;
  document_sha256: string | null;
  detail: Generated["public"]["Tables"]["contracts"]["Row"]["amenities"];
  created_at: string;
};

type PendingTables = {
  contract_signers: Table<
    ContractSigner,
    Partial<ContractSigner> & Pick<ContractSigner, "contract_id" | "owner_id" | "role" | "name" | "token_hash" | "token_expires_at">
  >;
  signature_events: Table<
    SignatureEvent,
    Partial<Omit<SignatureEvent, "id" | "detail">> & Pick<SignatureEvent, "contract_id" | "event"> & { detail?: unknown }
  >;
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

type GenTables = Generated["public"]["Tables"];

// Columns added by merge-time migrations (019, 020).
type ContractExtra = {
  document_sha256: string | null;
  sealed_pdf_path: string | null;
  sealed_pdf_sha256: string | null;
  sealed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
};
type ContractStatus = Generated["public"]["Enums"]["contract_status"] | "cancelled";
type ContractsPatched = {
  Row: Omit<GenTables["contracts"]["Row"], "status"> & ContractExtra & { status: ContractStatus };
  Insert: Omit<GenTables["contracts"]["Insert"], "status"> & Partial<ContractExtra> & { status?: ContractStatus };
  Update: Omit<GenTables["contracts"]["Update"], "status"> & Partial<ContractExtra> & { status?: ContractStatus };
  Relationships: GenTables["contracts"]["Relationships"];
};

type TenantsPatched = {
  Row: GenTables["tenants"]["Row"] & { preferred_locale: string };
  Insert: GenTables["tenants"]["Insert"] & { preferred_locale?: string };
  Update: GenTables["tenants"]["Update"] & { preferred_locale?: string };
  Relationships: GenTables["tenants"]["Relationships"];
};

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables"> & {
    Tables: Omit<GenTables, "tenants" | "contracts"> & { tenants: TenantsPatched; contracts: ContractsPatched } & PendingTables;
  };
};

export type { ContractSigner, SignatureEvent };

export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
