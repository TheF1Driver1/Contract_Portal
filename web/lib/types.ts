export type ContractStatus = "draft" | "sent" | "signed" | "expired";
export type ContractType = "lease" | "rental" | "addendum";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  unit_count: number;
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

  // Joined fields
  property?: Property;
  tenant?: Tenant;
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
  img_src: string | null;
  detail_url: string | null;
  home_type: string | null;
  home_status: string | null;
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
  rent_amount: number;
  rent_amount_verbal: string;
  security_deposit: number;
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

  // Signatures
  landlord_signature: string;
  tenant_signature: string;

  // Delivery
  send_email: boolean;
  send_sms: boolean;
  recipient_email: string;
  recipient_phone: string;
}
