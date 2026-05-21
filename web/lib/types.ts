export type ContractStatus = "draft" | "sent" | "signed" | "expired";
export type ContractType = "lease" | "rental" | "addendum";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  company_name: string | null;
  phone: string | null;
  email: string;
  role: 'landlord' | 'tenant';
  created_at: string;
}

export interface TenantInvite {
  id: string;
  token: string;
  contract_id: string;
  owner_id: string;
  tenant_email: string;
  tenant_name: string;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string | null;
  country: string | null;
  unit_count: number;
  bathroom_count: number;
  parking_available: boolean;
  parking_count: number | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Tenant {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  license_number: string | null;
  current_address: string | null;
  current_street: string | null;
  current_unit: string | null;
  current_city: string | null;
  current_state: string | null;
  current_zip: string | null;
  current_country: string | null;
  previous_street: string | null;
  previous_unit: string | null;
  previous_city: string | null;
  previous_state: string | null;
  previous_zip: string | null;
  previous_country: string | null;
  date_of_birth: string | null;
  employer_name: string | null;
  employer_phone: string | null;
  monthly_income: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  owner_id: string;
  property_id: string;
  tenant_id: string;
  contract_type: ContractType;
  status: ContractStatus;

  // Unit
  unit_number: string | null;

  // Lease dates
  lease_start: string;
  lease_end: string;
  lease_months: number;

  // Payment
  rent_amount: number;
  rent_amount_verbal: string | null;
  security_deposit: number;
  payment_due_day: number;
  late_fee_day: number;

  // Late fee policy
  late_fee_type: 'fixed' | 'daily' | 'both';
  late_fee_grace_period_days: number;
  late_fee_fixed_amount: number;
  late_fee_daily_amount: number;

  // Occupants
  occupant_names: string[];
  occupant_count: number;

  // Amenities (property-specific)
  amenities: Record<string, string | number | boolean>;

  // Keys
  key_count: number;

  // Signatures (base64)
  landlord_signature: string | null;
  tenant_signature: string | null;
  signed_at: string | null;

  // Document storage
  docx_url: string | null;
  pdf_url: string | null;

  // Delivery tracking
  sent_at: string | null;
  opened_at: string | null;

  created_at: string;
  updated_at: string;

  // Template used for this contract
  template_id?: string | null;

  // Immutable snapshots (frozen at contract creation/signing)
  tenant_snapshot: TenantSnapshot | null;
  property_snapshot: PropertySnapshot | null;

  // Renewal chain
  parent_contract_id: string | null;
  is_renewal: boolean;

  // Notification control
  suppress_notifications: boolean;

  // Joined fields
  property?: Property;
  tenant?: Tenant;
  template?: ContractTemplate;
  occupants?: ContractOccupant[];
}

export interface MarketProperty {
  id: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  latitude: number;
  longitude: number;
  imgSrc: string | null;
  detailUrl: string | null;
  homeType: string | null;
  homeStatus: string | null;
  daysOnZillow: number | null;
  original_price: number | null;
  num_price_cuts: number | null;
  price_cut_pct: number | null;
  last_cut_date: string | null;
  desperation_score: number | null;
}

export interface WatchlistItem {
  id: string
  owner_id: string
  zillow_id: string
  price: number | null
  beds: number | null
  baths: number | null
  street: string | null
  city: string | null
  state: string | null
  img_src: string | null
  detail_url: string | null
  home_type: string | null
  home_status: string | null
  saved_at: string
}

export interface InvestmentAnalysis {
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
  created_at: string;
  updated_at: string;
}

export interface InvestmentMetrics {
  // Upfront
  down_payment: number;
  closing_costs: number;
  total_upfront: number;
  loan_amount: number;
  // Monthly
  monthly_mortgage: number;
  monthly_tax: number;
  monthly_insurance: number;
  monthly_maintenance: number;
  monthly_hoa: number;
  monthly_utilities: number;
  total_monthly_expenses: number;
  // Income
  effective_monthly_rent: number;
  // Cash flow
  monthly_cash_flow: number;
  annual_cash_flow: number;
  // Returns
  cap_rate: number;
  cash_on_cash: number;
  gross_rent_multiplier: number;
  break_even_rent: number;
}

export interface TenantSnapshot {
  full_name: string;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  license_number: string | null;
  current_address: string | null;
  date_of_birth: string | null;
  employer_name: string | null;
  employer_phone: string | null;
  monthly_income: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export interface PropertySnapshot {
  name: string;
  address: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string | null;
  country: string | null;
  unit_count: number;
  bathroom_count: number;
  parking_available: boolean;
  parking_count: number | null;
}

export interface ContractOccupant {
  id: string;
  contract_id: string;
  owner_id: string;
  role: 'co_tenant' | 'guarantor' | 'emergency_contact';
  full_name: string;
  email: string | null;
  phone: string | null;
  ssn_last4: string | null;
  license_number: string | null;
  current_address: string | null;
  date_of_birth: string | null;
  tenant_id: string | null;
  signature: string | null;
  signed_at: string | null;
  snapshot: TenantSnapshot | null;
  created_at: string;
}

export interface ContractTemplate {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  file_url: string;
  contract_type: "all" | ContractType;
  is_default: boolean;
  created_at: string;
}

export interface PropertyCoOwner {
  id: string;
  property_id: string;
  owner_id: string;
  co_owner_id: string;
  ownership_pct: number;
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
  accepted_at: string | null;
  // Joined
  co_owner?: { id: string; full_name: string | null; email: string };
  property?: Property;
}

export interface BusinessGroup {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  // Joined
  members?: BusinessGroupMember[];
  properties?: BusinessGroupProperty[];
}

export interface BusinessGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'accepted' | 'declined';
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  // Joined
  profile?: { id: string; full_name: string | null; username: string | null; email: string };
  group?: { id: string; name: string };
}

export interface BusinessGroupProperty {
  id: string;
  group_id: string;
  property_id: string;
  added_by: string | null;
  added_at: string;
  // Joined
  property?: Property;
}

export interface GroupPropertyOwnership {
  id: string;
  group_id: string;
  property_id: string;
  user_id: string;
  ownership_pct: number;
  // Joined
  profile?: { id: string; full_name: string | null; email: string };
}

export interface NotificationTrigger {
  id: string;
  owner_id: string;
  days_before: number;
  send_sms: boolean;
  send_email: boolean;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PropertyExpense {
  id: string;
  property_id: string;
  user_id: string;
  category: 'maintenance'|'utilities'|'insurance'|'taxes'|'hoa'|
            'repairs'|'management'|'advertising'|'mortgage'|'other';
  amount: number;
  expense_date: string;
  description: string | null;
  vendor: string | null;
  is_tax_deductible: boolean;
  receipt_url: string | null;
  created_at: string;
  // Joined
  property?: Property;
}

export type NotificationChannel = 'sms' | 'email';
export type NotificationStatus  = 'sent' | 'failed' | 'suppressed';

export interface ContractNotificationLog {
  id: string;
  contract_id: string;
  owner_id: string;
  trigger_id: string | null;
  days_before: number;
  channel: NotificationChannel;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string;
}

export interface ContractAttachment {
  id: string;
  contract_id: string;
  owner_id: string;
  name: string;
  storage_path: string;
  file_size: number | null;
  created_at: string;
  // Injected on fetch
  signed_url?: string | null;
}

export interface ContractCustomSection {
  id: string;
  contract_id: string;
  owner_id: string;
  title: string;
  body: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface UserSectionTemplate {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

// Form values for contract builder
export interface ContractFormValues {
  // Contract meta
  contract_type: ContractType;
  property_id: string;
  unit_number: string;

  // Tenant
  tenant_id: string;

  // New tenant (if creating inline)
  tenant_full_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  tenant_ssn_last4?: string;
  tenant_license?: string;
  tenant_address?: string;

  // Dates
  lease_start: string;
  lease_end: string;
  lease_months: number;

  // Payment
  rent_amount: number | undefined;
  rent_amount_verbal: string;
  security_deposit: number | undefined;
  payment_due_day: number;
  late_fee_day: number;

  // Occupants
  occupant_names: string;
  occupant_count: number;

  // Amenities
  room_count: number;
  fan_count: number;
  stool_count: number;
  stove_count: number;
  key_count: number;
  mirror_doors: boolean;
  renovated_bathroom: boolean;
  microwave: boolean;
  fridge: boolean;
  ac: boolean;
  mini_blinds: boolean;
  sofa: boolean;
  futon: boolean;
  wall_art: boolean;
  parking: boolean;
  custom_amenities?: string;

  // Property counts
  bathroom_count: number;
  parking_available: boolean;
  parking_count: number;
  parking_spot: string;

  // Late fee policy
  late_fee_type: 'fixed' | 'daily' | 'both';
  late_fee_grace_period_days: number;
  late_fee_fixed_amount: number | undefined;
  late_fee_daily_amount: number | undefined;

  // Template
  template_id: string;

  // Signatures
  landlord_signature: string;
  tenant_signature: string;

  // Delivery
  send_email: boolean;
  send_sms: boolean;
  recipient_email: string;
  recipient_phone: string;
}
