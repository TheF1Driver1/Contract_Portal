// Database type used by every Supabase client. database.types.ts is generated
// from production; PendingTables covers tables created by migrations that are
// applied at merge (012, 013, 018, 020–023). Regenerate and delete entries once applied.
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

type RentLedger = { contract_id: string; owner_id: string; started_on: string; late_fees: boolean; created_at: string };
type RentCharge = {
  id: string;
  contract_id: string;
  owner_id: string;
  kind: "rent" | "late_fee" | "other";
  period: string | null;
  due_date: string;
  amount: number;
  description: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};
type PaymentMethod = "ath_movil" | "ach" | "card" | "cash" | "check" | "transfer" | "other";
type Payment = {
  id: string;
  number: number;
  contract_id: string;
  owner_id: string;
  amount: number;
  method: PaymentMethod;
  received_on: string;
  reference: string | null;
  note: string | null;
  source: "manual" | "ath_movil" | "stripe";
  external_id: string | null;
  receipt_sent_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

// ── Messaging (Plan 34, migration 023) ─────────────────────────────────────
type MessageChannel = "email" | "sms" | "whatsapp";
type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | "received";
type MessageLog = {
  id: string;
  owner_id: string;
  contract_id: string | null;
  direction: "outbound" | "inbound";
  recipient_kind: "tenant" | "landlord" | "signer";
  recipient_id: string | null;
  channel: MessageChannel;
  template: string;
  locale: "es" | "en";
  to_address: string;
  body: string | null;
  idempotency_key: string | null;
  provider: "resend" | "twilio" | null;
  provider_id: string | null;
  status: MessageStatus;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};
type ConsentSource = "lease_signing" | "portal" | "landlord_attested" | "inbound_stop" | "inbound_start";
type MessagingConsent = {
  id: string;
  owner_id: string;
  subject_kind: "tenant" | "landlord";
  subject_id: string;
  channel: MessageChannel;
  address: string;
  status: "opted_in" | "opted_out";
  source: ConsentSource;
  consented_at: string;
  updated_at: string;
};

// ── Plan 35: PR tax pack (migration 025) ──────────────────────────────────────
type TaxResidency = "pr_resident" | "non_resident";
type PropertyCrim = {
  id: string;
  property_id: string;
  owner_id: string;
  catastro_number: string | null;
  account_number: string | null;
  municipality: string | null;
  assessed_value: number | null;
  exemption_principal_residence: boolean;
  exoneration_amount: number | null;
  notes: string | null;
  purchase_price: number | null;
  building_pct: number | null;
  placed_in_service: string | null;
  created_at: string;
  updated_at: string;
};
type CrimBill = {
  id: string;
  property_id: string;
  owner_id: string;
  fiscal_year: string;
  installment: number;
  amount: number;
  due_date: string;
  paid_on: string | null;
  payment_reference: string | null;
  expense_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

type PendingTables = {
  message_log: Table<
    MessageLog,
    Partial<Omit<MessageLog, "id">> & Pick<MessageLog, "owner_id" | "recipient_kind" | "channel" | "template" | "to_address">
  >;
  messaging_consents: Table<
    MessagingConsent,
    Partial<Omit<MessagingConsent, "id">> &
      Pick<MessagingConsent, "owner_id" | "subject_kind" | "subject_id" | "channel" | "address" | "status" | "source">
  >;
  property_crim: Table<PropertyCrim, Partial<Omit<PropertyCrim, "id">> & Pick<PropertyCrim, "property_id" | "owner_id">>;
  crim_bills: Table<
    CrimBill,
    Partial<Omit<CrimBill, "id">> & Pick<CrimBill, "property_id" | "owner_id" | "fiscal_year" | "installment" | "amount" | "due_date">
  >;
  rent_ledgers: Table<RentLedger, Partial<RentLedger> & Pick<RentLedger, "contract_id" | "owner_id" | "started_on">>;
  rent_charges: Table<RentCharge, Partial<RentCharge> & Pick<RentCharge, "contract_id" | "owner_id" | "kind" | "due_date" | "amount">>;
  payments: Table<
    Payment,
    Partial<Omit<Payment, "id" | "number">> & Pick<Payment, "contract_id" | "owner_id" | "amount" | "method" | "received_on">
  >;
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
  // Plan 39 (migration 027)
  ai_usage_events: Table<
    { id: number; owner_id: string; feature: string; model: string | null; input_tokens: number | null; output_tokens: number | null; created_at: string },
    { owner_id: string; feature: string; model?: string | null; input_tokens?: number | null; output_tokens?: number | null }
  >;
  lifecycle_email_log: Table<{ user_id: string; step: string; sent_at: string }, { user_id: string; step: string }>;
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

// lifecycle_emails (021); tax_residency (025, Plan 35).
type ProfilesPatched = {
  // digest_emails: migration 023 (Plan 34); tax_residency: migration 025 (Plan 35)
  Row: GenTables["profiles"]["Row"] & { lifecycle_emails: boolean; digest_emails: boolean; tax_residency: TaxResidency | null };
  Insert: GenTables["profiles"]["Insert"] & { lifecycle_emails?: boolean; digest_emails?: boolean; tax_residency?: TaxResidency | null };
  Update: GenTables["profiles"]["Update"] & { lifecycle_emails?: boolean; digest_emails?: boolean; tax_residency?: TaxResidency | null };
  Relationships: GenTables["profiles"]["Relationships"];
};

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
    Tables: Omit<GenTables, "tenants" | "contracts" | "profiles"> & {
      tenants: TenantsPatched;
      contracts: ContractsPatched;
      profiles: ProfilesPatched;
    } & PendingTables;
  };
};

export type { ContractSigner, SignatureEvent, RentLedger, RentCharge, Payment, PaymentMethod };
export type { MessageLog, MessageChannel, MessageStatus, MessagingConsent, ConsentSource };
export type { TaxResidency, PropertyCrim, CrimBill };

export type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
