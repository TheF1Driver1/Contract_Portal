// Deterministic demo data for screenshots and accessibility checks.
// Dates are relative to "today" so alerts and KPIs always have content.
const day = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const ts = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();

export const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@prcontract.online",
  user_metadata: { full_name: "María Rivera" },
  app_metadata: { provider: "email" },
  created_at: ts(-200),
};

const P1 = { id: "10000000-0000-4000-8000-000000000001", owner_id: USER.id, name: "Edificio Las Palmas 2B", address: "Calle Loíza 1850", unit: "2B", city: "San Juan", state: "PR", zip: "00911", country: "US", unit_count: 1, bathroom_count: 1, parking_available: true, parking_count: 1, jurisdiction: "pr", latitude: 18.452, longitude: -66.06, created_at: ts(-180) };
const P2 = { id: "10000000-0000-4000-8000-000000000002", owner_id: USER.id, name: "Casa Dorado", address: "Calle 5 #22, Urb. Costa de Oro", unit: null, city: "Dorado", state: "PR", zip: "00646", country: "US", unit_count: 3, bathroom_count: 2, parking_available: true, parking_count: 2, jurisdiction: "pr", latitude: 18.46, longitude: -66.27, created_at: ts(-150) };
const P3 = { id: "10000000-0000-4000-8000-000000000003", owner_id: USER.id, name: "Apartamento Condado 7A", address: "Av. Ashford 1002", unit: "7A", city: "San Juan", state: "PR", zip: "00907", country: "US", unit_count: 1, bathroom_count: 2, parking_available: false, parking_count: null, jurisdiction: "pr", latitude: 18.458, longitude: -66.07, created_at: ts(-90) };

const tenant = (n, name, email, phone) => ({ id: `20000000-0000-4000-8000-00000000000${n}`, owner_id: USER.id, full_name: name, email, phone, ssn_last4: null, license_number: null, current_address: null, date_of_birth: null, employer_name: null, employer_phone: null, monthly_income: null, emergency_contact_name: null, emergency_contact_phone: null, created_at: ts(-100 + n) });
const T1 = tenant(1, "José Martínez", "jose.martinez@example.com", "+17875550101");
const T2 = tenant(2, "Ana Colón", "ana.colon@example.com", "+17875550102");
const T3 = tenant(3, "Luis Ortiz", "luis.ortiz@example.com", null);

const contract = (n, p, t, extra) => ({
  id: `30000000-0000-4000-8000-00000000000${n}`,
  owner_id: USER.id,
  property_id: p.id,
  tenant_id: t.id,
  contract_type: "lease",
  status: "signed",
  lease_start: iso(-300),
  lease_end: iso(65),
  lease_months: 12,
  rent_amount: 1200,
  rent_amount_verbal: "mil doscientos dólares",
  security_deposit: 1200,
  payment_due_day: 1,
  late_fee_day: 5,
  late_fee_type: "fixed",
  late_fee_grace_period_days: 5,
  late_fee_fixed_amount: 50,
  late_fee_daily_amount: 0,
  occupant_names: [],
  occupant_count: 1,
  key_count: 2,
  amenities: {},
  governing_law: "codigo_civil_pr_2020",
  landlord_signature: null,
  tenant_signature: null,
  signed_at: ts(-300),
  sent_at: ts(-305),
  created_at: ts(-306),
  updated_at: ts(-300),
  pdf_url: null,
  docx_url: null,
  template_id: null,
  parent_contract_id: null,
  suppress_notifications: false,
  property: p,
  tenant: t,
  ...extra,
});

export const TABLES = {
  profiles: [{ id: USER.id, email: USER.email, full_name: "María Rivera", username: "mrivera", company_name: "Rivera Propiedades", phone: "+17875550100", role: "landlord", locale: "es", plan: "propietario", created_at: ts(-200) }],
  properties: [P1, P2, P3],
  tenants: [T1, T2, T3],
  contracts: [
    contract(1, P1, T1, { lease_end: iso(28), rent_amount: 1150 }),
    contract(2, P2, T2, { status: "sent", signed_at: null, sent_at: ts(-6), lease_start: iso(10), lease_end: iso(375), rent_amount: 2100 }),
    contract(3, P3, T3, { status: "draft", signed_at: null, sent_at: null, lease_start: iso(20), lease_end: iso(385), rent_amount: 1650 }),
  ],
  property_expenses: [
    { id: "40000000-0000-4000-8000-000000000001", user_id: USER.id, property_id: P1.id, category: "maintenance", amount: 240, description: "Reparación de calentador", vendor: "Plomería Boricua", expense_date: iso(-20), is_tax_deductible: true, is_mortgage_interest: false, receipt_url: null, created_at: ts(-20), property: { name: P1.name } },
    { id: "40000000-0000-4000-8000-000000000002", user_id: USER.id, property_id: P2.id, category: "insurance", amount: 980, description: "Póliza anual", vendor: "MAPFRE", expense_date: iso(-45), is_tax_deductible: true, is_mortgage_interest: false, receipt_url: null, created_at: ts(-45), property: { name: P2.name } },
    { id: "40000000-0000-4000-8000-000000000003", user_id: USER.id, property_id: P2.id, category: "taxes", amount: 1430, description: "CRIM 2025-26", vendor: "CRIM", expense_date: iso(-70), is_tax_deductible: true, is_mortgage_interest: false, receipt_url: null, created_at: ts(-70), property: { name: P2.name } },
  ],
  contract_notification_logs: [
    { id: "50000000-0000-4000-8000-000000000001", owner_id: USER.id, contract_id: "30000000-0000-4000-8000-000000000001", trigger_id: null, channel: "sms", days_before: 30, status: "failed", error_message: "unreachable", sent_at: ts(-1) },
  ],
  notification_triggers: [
    { id: "60000000-0000-4000-8000-000000000001", owner_id: USER.id, days_before: 60, send_email: true, send_sms: false, is_active: true, label: "60 días", created_at: ts(-100) },
    { id: "60000000-0000-4000-8000-000000000002", owner_id: USER.id, days_before: 30, send_email: true, send_sms: true, is_active: true, label: "30 días", created_at: ts(-100) },
  ],
  subscriptions: [{ id: "70000000-0000-4000-8000-000000000001", owner_id: USER.id, plan: "propietario", status: "active", stripe_customer_id: "cus_demo", stripe_subscription_id: "sub_demo", current_period_end: ts(20), created_at: ts(-60), updated_at: ts(-1) }],
};
