import { z } from "zod";
import "@/lib/zod-es"; // Spanish validation messages

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
  tenant_snapshot: z.record(z.any()).optional().nullable(),
  property_snapshot: z.record(z.any()).optional().nullable(),
  governing_law: z.enum(['codigo_civil_pr_2020', 'us_state', 'other']).optional().nullable(),
  template_version: z.string().max(20).optional().nullable(),
});

export const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  suppress_notifications: z.boolean().optional(),
});

/** The only fields PATCH /api/contracts/[id] accepts. */
export const ContractPatchSchema = z.object({ suppress_notifications: z.boolean() }).strict();

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
  jurisdiction: z.enum(['pr', 'us_mainland', 'other', 'all']).optional().nullable(),
  is_system: z.boolean().optional().default(false),
  template_version: z.string().max(20).optional().default('1.0.0'),
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

// ── Ad-hoc email send ─────────────────────────────────────────────────────────

export const SendAdHocEmailSchema = z.object({
  landlordEmail: z.string().email().max(254).optional(),
  tenantEmail: z.string().email().max(254).optional(),
}).refine((d) => d.landlordEmail || d.tenantEmail, {
  message: "At least one recipient required",
});

// ── Contract attachments ──────────────────────────────────────────────────────

export const ContractAttachmentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  storage_path: z.string().min(1).max(500),
  file_size: z.number().int().min(0).optional().nullable(),
});

// ── Contract sections ─────────────────────────────────────────────────────────

export const ContractCustomSectionCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(100_000).default(""),
  order_index: z.number().int().min(0).optional().default(0),
});

export const ContractCustomSectionUpdateSchema = ContractCustomSectionCreateSchema.partial();

// ── User section templates ────────────────────────────────────────────────────

export const UserSectionTemplateCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(100_000).default(""),
});

export const UserSectionTemplateUpdateSchema = UserSectionTemplateCreateSchema.partial();

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
  jurisdiction: z.enum(['pr', 'us_mainland', 'other']).optional(),
});

export const PropertyCreateSchema = PropertyUpdateSchema.required({
  name: true,
  address: true,
  city: true,
  state: true,
});

// ── Tenant portal signing ─────────────────────────────────────────────────────

export const TenantSignatureSchema = z.object({
  tenant_signature: z.string().min(100).max(100_000).startsWith('data:image/'),
});

// ── Landlord-side signature capture (landlord or in-person tenant) ───────────

export const ContractSignatureSchema = z.object({
  role: z.enum(['landlord', 'tenant']),
  signature: z.string().min(100).max(100_000).startsWith('data:image/'),
});

export const ContractSignatureDeleteSchema = z.object({
  role: z.enum(['landlord', 'tenant']),
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
  current_street: z.string().max(300).optional().nullable(),
  current_unit: z.string().max(100).optional().nullable(),
  current_city: z.string().max(100).optional().nullable(),
  current_state: z.string().max(100).optional().nullable(),
  current_zip: z.string().max(20).optional().nullable(),
  current_country: z.string().max(100).optional().nullable(),
  previous_street: z.string().max(300).optional().nullable(),
  previous_unit: z.string().max(100).optional().nullable(),
  previous_city: z.string().max(100).optional().nullable(),
  previous_state: z.string().max(100).optional().nullable(),
  previous_zip: z.string().max(20).optional().nullable(),
  previous_country: z.string().max(100).optional().nullable(),
  preferred_locale: z.enum(["es", "en"]).optional(),
});

export const TenantCreateSchema = TenantUpdateSchema.required({ full_name: true });

// ── Subscription ──────────────────────────────────────────────────────────────

export const SubscriptionUpdateSchema = z.object({
  plan: z.enum(['free', 'propietario', 'inversionista', 'enterprise']),
});

// ── Property manager invite ───────────────────────────────────────────────────

export const PropertyManagerInviteSchema = z.object({
  manager_email: z.string().email().max(254),
  property_ids: z.array(z.string().uuid()).min(1).max(50),
  permissions: z.object({
    view: z.boolean().default(true),
    create_contracts: z.boolean().default(true),
    sign_contracts: z.boolean().default(false),
  }).optional(),
});

// ── Rent ledger (Plan 33) ─────────────────────────────────────────────────────

const money = z.number().positive().max(1_000_000).transform((n) => Math.round(n * 100) / 100);

export const LedgerEnableSchema = z.object({
  contract_id: z.string().uuid(),
  started_on: isoDate,
  late_fees: z.boolean().default(true),
});

export const LedgerSettingsSchema = z.object({
  contract_id: z.string().uuid(),
  late_fees: z.boolean(),
});

export const PaymentCreateSchema = z.object({
  contract_id: z.string().uuid(),
  amount: money,
  method: z.enum(["ath_movil", "ach", "card", "cash", "check", "transfer", "other"]),
  received_on: isoDate,
  reference: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  send_receipt: z.boolean().default(true),
});

export const ChargeCreateSchema = z.object({
  contract_id: z.string().uuid(),
  amount: money,
  due_date: isoDate,
  description: z.string().trim().min(1).max(200),
});

export const VoidSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
});

// ── Marketing contact form (Plan 37) ──────────────────────────────────────────

export const ContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(160).optional().default(""),
  units: z.coerce.number().int().min(0).max(100000).optional(),
  message: z.string().trim().min(10).max(3000),
  locale: z.enum(["es", "en"]).default("es"),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional().default(""),
});

// ── Messaging (Plan 34) ───────────────────────────────────────────────────────

export const TenantConsentSchema = z.object({
  tenant_id: z.string().uuid(),
  channel: z.enum(["sms", "whatsapp"]),
  opted_in: z.boolean(),
});

// ── PR tax pack (Plan 35) ─────────────────────────────────────────────────────

const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((s) => (s ? s : null));
const optMoney = z.number().min(0).max(100_000_000).optional().nullable().transform((n) => (n == null ? null : Math.round(n * 100) / 100));

export const TaxResidencySchema = z.object({
  tax_residency: z.enum(["pr_resident", "non_resident"]).nullable(),
});

export const CrimAccountSchema = z.object({
  property_id: z.string().uuid(),
  catastro_number: optText(40),
  account_number: optText(40),
  municipality: optText(60),
  assessed_value: optMoney,
  exemption_principal_residence: z.boolean().default(false),
  exoneration_amount: optMoney,
  notes: optText(1000),
  purchase_price: optMoney,
  building_pct: z.number().min(0).max(100).optional().nullable().transform((n) => (n == null ? null : Math.round(n * 100) / 100)),
  placed_in_service: isoDate.optional().nullable(),
});

export const CrimBillCreateSchema = z.object({
  property_id: z.string().uuid(),
  fiscal_year: z.string().regex(/^\d{4}-\d{2}$/),
  installment: z.number().int().min(1).max(4),
  amount: z.number().positive().max(10_000_000).transform((n) => Math.round(n * 100) / 100),
  due_date: isoDate,
});

export const CrimBillPaySchema = z.object({
  id: z.string().uuid(),
  paid_on: isoDate,
  payment_reference: optText(100),
  create_expense: z.boolean().default(true),
});

export const CrimBillVoidSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
});

// ── Maintenance and inspections (Plan 36) ─────────────────────────────────────

const maintenanceCategory = z.enum(["plumbing", "electrical", "appliance", "ac", "pest", "structural", "other"]);
const maintenanceUrgency = z.enum(["low", "normal", "urgent", "emergency"]);
const maintenanceStatus = z.enum(["open", "scheduled", "in_progress", "resolved", "cancelled"]);
const optNullText = (max: number) => z.string().trim().max(max).optional().nullable();

export const MaintenanceCreateSchema = z.object({
  contract_id: uuid,
  title: z.string().trim().min(1).max(120),
  description: optNullText(2000),
  category: maintenanceCategory,
  urgency: maintenanceUrgency,
});

export const MaintenanceUpdateSchema = z.object({
  id: uuid,
  status: maintenanceStatus.optional(),
  vendor_name: optNullText(120),
  vendor_phone: optNullText(30),
  scheduled_for: isoDate.optional().nullable().or(z.literal("")),
  cost: z.number().min(0).max(1_000_000).transform((n) => Math.round(n * 100) / 100).optional().nullable(),
  urgency: maintenanceUrgency.optional(),
  note: optNullText(2000),
});

export const MaintenanceNoteSchema = z.object({
  id: uuid,
  note: z.string().trim().min(1).max(2000),
});

export const MaintenanceExpenseSchema = z.object({
  id: uuid,
  amount: z.number().positive().max(1_000_000).transform((n) => Math.round(n * 100) / 100),
  expense_date: isoDate,
  category: z.enum(["repairs", "maintenance"]),
});

export const PhotoUploadRequestSchema = z.object({
  scope: z.enum(["maintenance", "inspections"]),
  record_id: uuid,
  item_id: uuid.optional().nullable(),
  content_type: z.string().max(40),
  size: z.number().int().positive(),
});

export const PhotoRegisterSchema = z.object({
  scope: z.enum(["maintenance", "inspections"]),
  record_id: uuid,
  item_id: uuid.optional().nullable(),
  path: z.string().max(300),
});

export const InspectionCreateSchema = z.object({
  contract_id: uuid,
  kind: z.enum(["move_in", "move_out"]),
});

export const InspectionItemSchema = z.object({
  id: uuid,
  condition: z.enum(["good", "fair", "poor", "damaged", "na"]).nullable().optional(),
  note: optNullText(1000),
});

export const InspectionDetailsSchema = z.object({
  id: uuid,
  inspected_on: isoDate,
  notes: optNullText(4000),
});

export const InspectionCompleteSchema = z.object({
  id: uuid,
  confirm: z.literal(true),
});

export const InspectionAckSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2).max(120),
  confirm: z.literal(true),
});

// ── Plan 39: AI drafting (clause translation, notices, Q&A) ────────────────
export const AiTranslateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(8000).default(""),
  target: z.enum(["en", "es"]),
});

export const AiNoticeSchema = z.object({
  contract_id: uuid,
  kind: z.enum(["late_payment", "renewal_offer"]),
  // Used only when the lease has no rent ledger.
  amount_overdue: z.number().positive().max(1_000_000).nullable().optional(),
  proposed_rent: z.number().positive().max(1_000_000).nullable().optional(),
  proposed_term_months: z.number().int().min(1).max(60).nullable().optional(),
});

export const AiAskDataSchema = z.object({
  question: z.string().trim().min(3).max(300),
});
// ── end Plan 39 ─────────────────────────────────────────────────────────────
