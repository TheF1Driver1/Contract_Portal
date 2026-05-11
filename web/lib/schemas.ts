import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const dayOfMonth = z.number().int().min(1).max(31);
const pct = z.number().min(0).max(100);
const nonNeg = z.number().min(0);
const positiveNum = z.number().positive();

// ── Contracts ────────────────────────────────────────────────────────────────

export const ContractCreateSchema = z.object({
  property_id: uuid,
  tenant_id: uuid,
  contract_type: z.enum(["lease", "rental", "addendum"]),
  unit_number: z.string().max(20).optional().nullable(),
  lease_start: isoDate,
  lease_end: isoDate,
  lease_months: z.number().int().min(1).max(120),
  rent_amount: positiveNum,
  rent_amount_verbal: z.string().max(200).optional().nullable(),
  security_deposit: nonNeg,
  payment_due_day: dayOfMonth,
  late_fee_day: dayOfMonth,
  occupant_names: z.array(z.string().max(200)).max(20),
  occupant_count: z.number().int().min(1).max(20),
  amenities: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  key_count: z.number().int().min(0).max(50),
  landlord_signature: z.string().max(100_000).optional().nullable(),
  tenant_signature: z.string().max(100_000).optional().nullable(),
  status: z.enum(["draft", "sent", "signed", "expired"]).optional(),
  template_id: uuid.optional().nullable(),
  late_fee_type: z.enum(['fixed', 'daily', 'both']).default('fixed'),
  late_fee_grace_period_days: z.number().int().min(0).max(30).default(0),
  late_fee_fixed_amount: nonNeg.default(0),
  late_fee_daily_amount: nonNeg.default(0),
  tenant_snapshot: z.record(z.unknown()).optional().nullable(),
  property_snapshot: z.record(z.unknown()).optional().nullable(),
});

export const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  suppress_notifications: z.boolean().optional(),
});

// ── Send contract ────────────────────────────────────────────────────────────

export const SendContractSchema = z.object({
  contractId: uuid,
  landlordEmail: z.string().email().max(254).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number")
    .optional(),
});

// ── Watchlist ────────────────────────────────────────────────────────────────

export const WatchlistUpsertSchema = z.object({
  zillow_id: z.string().min(1).max(50),
  price: z.number().optional().nullable(),
  beds: z.number().int().min(0).max(50).optional().nullable(),
  baths: z.number().min(0).max(50).optional().nullable(),
  street: z.string().max(300).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  img_src: z.string().url().max(2048).optional().nullable(),
  detail_url: z.string().url().max(2048).optional().nullable(),
  home_type: z.string().max(100).optional().nullable(),
  home_status: z.string().max(100).optional().nullable(),
});

export const WatchlistDeleteSchema = z.object({
  zillow_id: z.string().min(1).max(50),
});

// ── Investment analysis ──────────────────────────────────────────────────────

export const InvestmentAnalysisSchema = z.object({
  purchase_price: positiveNum,
  down_payment_pct: pct,
  closing_cost_pct: pct,
  mortgage_rate_pct: pct,
  loan_term_years: z.number().int().min(1).max(50),
  annual_tax_pct: pct,
  annual_insurance_pct: pct,
  maintenance_pct: pct,
  monthly_hoa: nonNeg,
  monthly_utilities: nonNeg,
  estimated_rent: positiveNum.optional().nullable(),
  vacancy_rate_pct: pct,
});

// ── Geocode ──────────────────────────────────────────────────────────────────

export const GeocodeSchema = z.object({
  id: uuid,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ── Market properties query params ───────────────────────────────────────────

export const MarketPropertiesQuerySchema = z.object({
  city: z.string().min(1).max(100).optional(),
  min_price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  max_price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  beds: z
    .string()
    .regex(/^\d+$/)
    .refine((v) => parseInt(v) <= 20, "beds max 20")
    .optional(),
});

// ── CRIM rate query params ───────────────────────────────────────────────────

export const CrimRateQuerySchema = z.object({
  city: z.string().min(1).max(100),
  fiscal_year: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Expected YYYY-YYYY")
    .optional(),
});

// ── Generate contract ────────────────────────────────────────────────────────

export const GenerateContractSchema = z.object({
  contractId: uuid,
  format: z.enum(["docx", "pdf"]).optional().default("pdf"),
  store: z.boolean().optional().default(false),
});

// ── Contract templates ───────────────────────────────────────────────────────

export const TemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  contract_type: z.enum(["all", "lease", "rental", "addendum"]).default("all"),
  is_default: z.boolean().optional().default(false),
});

export const TemplateSetDefaultSchema = z.object({
  id: uuid,
});

// ── Notification triggers ─────────────────────────────────────────────────────

export const NotificationTriggerCreateSchema = z.object({
  days_before: z.number().int().min(1).max(365),
  send_sms:    z.boolean().default(true),
  send_email:  z.boolean().default(true),
  label:       z.string().max(100).optional().nullable(),
  is_active:   z.boolean().default(true),
});

export const NotificationTriggerUpdateSchema = NotificationTriggerCreateSchema.partial();

// ── Property update ──────────────────────────────────────────────────────────

export const PropertyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(300).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(10).optional(),
  zip: z.string().max(20).optional().nullable(),
  unit_count: z.number().int().min(1).max(1000).optional(),
  bathroom_count: z.number().int().min(0).max(50).optional(),
  parking_available: z.boolean().optional(),
  parking_count: z.number().int().min(0).max(500).optional().nullable(),
});

// ── Tenant update ────────────────────────────────────────────────────────────

export const TenantUpdateSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  ssn_last4: z.string().length(4).regex(/^\d{4}$/).optional().nullable(),
  license_number: z.string().max(50).optional().nullable(),
  current_address: z.string().max(300).optional().nullable(),
  date_of_birth: isoDate.optional().nullable(),
  employer_name: z.string().max(200).optional().nullable(),
  employer_phone: z.string().max(30).optional().nullable(),
  monthly_income: nonNeg.optional().nullable(),
  emergency_contact_name: z.string().max(200).optional().nullable(),
  emergency_contact_phone: z.string().max(30).optional().nullable(),
});
