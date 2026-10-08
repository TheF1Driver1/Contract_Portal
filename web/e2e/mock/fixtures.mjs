import { createHash } from "node:crypto";

// Signing link used by e2e and screenshots: /sign/<DEMO_SIGN_TOKEN>
export const DEMO_SIGN_TOKEN = "demoSigningToken_000000000000000000000000000000";
const tokenHash = (t) => createHash("sha256").update(`signing-token:${t}`).digest("hex");

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

// Rent ledger on lease 1: three months posted, the latest one unpaid and late.
const monthStart = (back) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10);
};
const C1 = "30000000-0000-4000-8000-000000000001";
const charge = (n, kind, back, amount, due = monthStart(back)) => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`, contract_id: C1, owner_id: USER.id, kind, period: monthStart(back),
  due_date: due, amount, description: null, voided_at: null, void_reason: null, created_at: ts(-30 * back),
});
const payment = (n, back, amount, method, reference = null) => ({
  id: `b0000000-0000-4000-8000-00000000000${n}`, number: 1040 + n, contract_id: C1, owner_id: USER.id, amount, method,
  received_on: monthStart(back).slice(0, 8) + "03", reference, note: null, source: "manual", external_id: null,
  receipt_sent_at: ts(-30 * back), voided_at: null, void_reason: null, created_at: ts(-30 * back),
});

// Plan 35: CRIM for property 1 — one installment due in 12 days (bell + Hoy), one paid last year.
const fyOf = (d) => {
  const y = Number(d.slice(0, 4));
  const start = Number(d.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};
const FY = fyOf(iso(0));
const PREV_FY = `${Number(FY.slice(0, 4)) - 1}-${FY.slice(2, 4)}`;

// ── Plan 36: maintenance requests and inspections on lease 1 ──
const P36_REQ = (n) => `c0000000-0000-4000-8000-00000000000${n}`;
const P36_INSP = (n) => `d0000000-0000-4000-8000-00000000000${n}`;
const p36Request = (n, extra) => ({
  id: P36_REQ(n), contract_id: C1, property_id: P1.id, owner_id: USER.id, submitted_by: null, submitted_by_kind: "tenant",
  title: "", description: null, category: "plumbing", urgency: "normal", status: "open", vendor_name: null, vendor_phone: null,
  scheduled_for: null, resolved_at: null, cost: null, expense_id: null, created_at: ts(-2), updated_at: ts(-2), ...extra,
});
const p36Items = (inspection, kind) => {
  const rooms = { living: ["walls", "floors", "doors", "windows"], kitchen: ["walls", "floors", "stove", "fridge", "sink"], bathroom_1: ["walls", "toilet", "basin", "shower"] };
  const out = [];
  for (const [room, items] of Object.entries(rooms)) {
    for (const item of items) {
      const n = out.length;
      const condition = kind === "move_in" ? (n === 6 ? "fair" : "good") : n < 3 ? (n === 1 ? "damaged" : "good") : null;
      out.push({ id: `e000000${kind === "move_in" ? 1 : 2}-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, inspection_id: inspection, owner_id: USER.id, room, item, condition, note: n === 1 && kind === "move_out" ? "Rayazo profundo cerca de la puerta" : null, sort: n });
    }
  }
  return out;
};
const P36 = {
  maintenance_requests: [
    p36Request(1, { title: "Gotera debajo del fregadero", description: "Sale agua cada vez que se usa el fregadero. Ya puse un cubo.", urgency: "urgent", created_at: ts(-1), updated_at: ts(-1) }),
    p36Request(2, { title: "El aire del cuarto no enfría", category: "ac", status: "scheduled", vendor_name: "Frío Boricua", vendor_phone: "+17875550199", scheduled_for: iso(2), created_at: ts(-5) }),
    p36Request(3, { title: "Cambiar bombilla del pasillo", category: "electrical", urgency: "low", status: "resolved", submitted_by_kind: "landlord", cost: 18.5, resolved_at: ts(-20), created_at: ts(-25) }),
  ],
  maintenance_updates: [
    { id: "c1000000-0000-4000-8000-000000000001", request_id: P36_REQ(1), owner_id: USER.id, author_kind: "tenant", note: null, status_change: "open", created_at: ts(-1) },
    { id: "c1000000-0000-4000-8000-000000000002", request_id: P36_REQ(1), owner_id: USER.id, author_kind: "tenant", note: "Hoy está peor, por favor.", status_change: null, created_at: ts(-0.5) },
  ],
  maintenance_photos: [],
  inspections: [
    { id: P36_INSP(1), contract_id: C1, owner_id: USER.id, kind: "move_in", status: "completed", inspected_on: iso(-300), notes: "Se entregaron 2 llaves y 1 control del portón.", landlord_signed_at: ts(-300), tenant_acknowledged_at: ts(-299), tenant_ack_name: "José Martínez", tenant_ack_ip: null, created_at: ts(-300), updated_at: ts(-299) },
    { id: P36_INSP(2), contract_id: C1, owner_id: USER.id, kind: "move_out", status: "draft", inspected_on: iso(0), notes: null, landlord_signed_at: null, tenant_acknowledged_at: null, tenant_ack_name: null, tenant_ack_ip: null, created_at: ts(-0.2), updated_at: ts(-0.2) },
  ],
  inspection_items: [...p36Items(P36_INSP(1), "move_in"), ...p36Items(P36_INSP(2), "move_out")],
  inspection_photos: [],
};

export const TABLES = {
  rent_ledgers: [{ contract_id: C1, owner_id: USER.id, started_on: monthStart(2), late_fees: true, created_at: ts(-70) }],
  rent_charges: [
    charge(1, "rent", 2, 1150),
    charge(2, "rent", 1, 1150),
    charge(3, "rent", 0, 1150),
    charge(4, "late_fee", 0, 50, monthStart(0).slice(0, 8) + "07"),
  ],
  payments: [payment(1, 2, 1150, "ath_movil", "ATH-48213"), payment(2, 1, 1150, "check", "Cheque 1187")],
  profiles: [{ id: USER.id, email: USER.email, full_name: "María Rivera", username: "mrivera", company_name: "Rivera Propiedades", phone: "+17875550100", role: "landlord", locale: "es", plan: "propietario", tax_residency: "pr_resident", created_at: ts(-200) }],
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
  contract_signers: [
    { id: "80000000-0000-4000-8000-000000000001", contract_id: "30000000-0000-4000-8000-000000000002", owner_id: USER.id, role: "tenant", name: "Ana Colón", email: "ana.colon@example.com", phone: "+17875550102", locale: "es", sign_order: 1, status: "viewed", token_hash: tokenHash(DEMO_SIGN_TOKEN), token_expires_at: ts(5), otp_hash: null, otp_expires_at: null, otp_attempts: 0, otp_channel: null, verified_at: null, consented_at: null, signed_at: null, signature_path: null, declined_reason: null, in_person: false, created_at: ts(-6) },
  ],
  signature_events: [
    { id: 1, contract_id: "30000000-0000-4000-8000-000000000002", signer_id: null, event: "requested", actor: "María Rivera", ip: null, created_at: ts(-6), detail: {} },
    { id: 2, contract_id: "30000000-0000-4000-8000-000000000002", signer_id: "80000000-0000-4000-8000-000000000001", event: "sent", actor: "Ana Colón", ip: null, created_at: ts(-6), detail: {} },
    { id: 3, contract_id: "30000000-0000-4000-8000-000000000002", signer_id: "80000000-0000-4000-8000-000000000001", event: "viewed", actor: "Ana Colón", ip: null, created_at: ts(-2), detail: {} },
  ],
  contract_custom_sections: [],
  // Messaging (Plan 34): newest first, as the app orders them.
  message_log: [
    { id: "c0000000-0000-4000-8000-000000000001", owner_id: USER.id, contract_id: C1, direction: "inbound", recipient_kind: "tenant", recipient_id: T1.id, channel: "whatsapp", template: "inbound", locale: "es", to_address: "+17875550101", body: "Buenas, ya envié el pago por ATH Móvil.", idempotency_key: null, provider: "twilio", provider_id: "SMin1", status: "received", error: null, sent_at: null, delivered_at: null, read_at: null, created_at: ts(-0.2) },
    { id: "c0000000-0000-4000-8000-000000000002", owner_id: USER.id, contract_id: C1, direction: "outbound", recipient_kind: "tenant", recipient_id: T1.id, channel: "whatsapp", template: "rent_overdue", locale: "es", to_address: "+17875550101", body: null, idempotency_key: `rent:${C1}:${monthStart(0)}:overdue`, provider: "twilio", provider_id: "SMwa2", status: "read", error: null, sent_at: ts(-1), delivered_at: ts(-1), read_at: ts(-0.9), created_at: ts(-1) },
    { id: "c0000000-0000-4000-8000-000000000003", owner_id: USER.id, contract_id: C1, direction: "outbound", recipient_kind: "tenant", recipient_id: T1.id, channel: "sms", template: "rent_reminder", locale: "es", to_address: "+17875550101", body: null, idempotency_key: null, provider: null, provider_id: null, status: "skipped", error: "no_consent", sent_at: null, delivered_at: null, read_at: null, created_at: ts(-9) },
    { id: "c0000000-0000-4000-8000-000000000004", owner_id: USER.id, contract_id: C1, direction: "outbound", recipient_kind: "tenant", recipient_id: T1.id, channel: "email", template: "receipt", locale: "es", to_address: T1.email, body: null, idempotency_key: "receipt:b0000000-0000-4000-8000-000000000002", provider: "resend", provider_id: "re_demo2", status: "delivered", error: null, sent_at: ts(-28), delivered_at: ts(-28), read_at: null, created_at: ts(-28) },
  ],
  messaging_consents: [
    { id: "d0000000-0000-4000-8000-000000000001", owner_id: USER.id, subject_kind: "tenant", subject_id: T1.id, channel: "whatsapp", address: "+17875550101", status: "opted_in", source: "landlord_attested", consented_at: ts(-40), updated_at: ts(-40) },
    { id: "d0000000-0000-4000-8000-000000000002", owner_id: USER.id, subject_kind: "tenant", subject_id: T1.id, channel: "sms", address: "+17875550101", status: "opted_out", source: "inbound_stop", consented_at: ts(-12), updated_at: ts(-12) },
  ],
  subscriptions: [{ id: "70000000-0000-4000-8000-000000000001", owner_id: USER.id, plan: "propietario", status: "active", stripe_customer_id: "cus_demo", stripe_subscription_id: "sub_demo", current_period_end: ts(20), created_at: ts(-60), updated_at: ts(-1) }],
  // ── Plan 35: PR tax pack ──
  crim_tax_rates: [
    { municipality: "San Juan", fiscal_year: `${FY.slice(0, 4)}-${Number(FY.slice(0, 4)) + 1}`, mueble_rate: 8.83, inmueble_rate: 10.83, source_url: null },
    { municipality: "Dorado", fiscal_year: `${FY.slice(0, 4)}-${Number(FY.slice(0, 4)) + 1}`, mueble_rate: 8.83, inmueble_rate: 10.58, source_url: null },
    { municipality: "Bayamón", fiscal_year: `${FY.slice(0, 4)}-${Number(FY.slice(0, 4)) + 1}`, mueble_rate: 7.58, inmueble_rate: 9.58, source_url: null },
  ],
  property_crim: [
    { id: "c1000000-0000-4000-8000-000000000001", property_id: P1.id, owner_id: USER.id, catastro_number: "040-012-345-67", account_number: "1234567", municipality: "San Juan", assessed_value: 42000, exemption_principal_residence: false, exoneration_amount: null, notes: null, purchase_price: 265000, building_pct: 80, placed_in_service: "2021-05-01", created_at: ts(-90), updated_at: ts(-10) },
  ],
  crim_bills: [
    { id: "c2000000-0000-4000-8000-000000000001", property_id: P1.id, owner_id: USER.id, fiscal_year: FY, installment: 1, amount: 2274.3, due_date: iso(12), paid_on: null, payment_reference: null, expense_id: null, voided_at: null, void_reason: null, created_at: ts(-20), property: { name: P1.name } },
    { id: "c2000000-0000-4000-8000-000000000002", property_id: P1.id, owner_id: USER.id, fiscal_year: PREV_FY, installment: 2, amount: 2274.3, due_date: iso(-200), paid_on: iso(-205), payment_reference: "CRIM-88412", expense_id: null, voided_at: null, void_reason: null, created_at: ts(-230), property: { name: P1.name } },
  ],
  ...P36,
};

// ── Plan 40: market data ────────────────────────────────────────────────────
// Zillow listings (public.zillow_market) with rentZestimate for comps/yields.
// Bayamón appears with and without the accent to exercise matching.
const zl = (n, city, price, rentZestimate, extra = {}) => ({
  id: 4100000 + n, price, beds: 3, baths: 2, street: `Calle Demo ${n}`, city, state: "PR", zipcode: "00900",
  latitude: 18.4 + n / 1000, longitude: -66.1 - n / 1000, imgSrc: "https://photos.zillowstatic.com/demo.jpg",
  detailUrl: `https://www.zillow.com/homedetails/${4100000 + n}_zpid/`, homeType: "SINGLE_FAMILY", homeStatus: "FOR_SALE",
  daysOnZillow: 10 + n, last_updated_date: ts(-3), original_price: price, num_price_cuts: 0, total_price_cut: 0,
  price_cut_pct: 0, daily_price_cut_rate: 0, last_cut_date: null, desperation_score: n % 4 === 0 ? 42 : 0,
  rentZestimate, livingArea: 1200, ...extra,
});
const ZILLOW_MARKET = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => zl(n, "San Juan", 240000 + n * 15000, 1250 + n * 50)),
  ...[9, 10, 11].map((n) => zl(n, "Bayamón", 180000 + n * 5000, 1100 + n * 20)),
  ...[12, 13, 14].map((n) => zl(n, "Bayamon", 175000 + n * 5000, 1050 + n * 20)),
  ...[15, 16, 17, 18, 19].map((n) => zl(n, "Ponce", 120000 + n * 3000, 850 + n * 10)),
  ...[20, 21].map((n) => zl(n, "Dorado", 650000, 3200)),
  zl(22, "San Juan", 1900, 1850, { homeStatus: "FOR_RENT" }),
];
const crim = (municipality, inmueble_rate, mueble_rate) =>
  ["2025-2026", "2026-2027"].map((fiscal_year) => ({ municipality, fiscal_year, inmueble_rate, mueble_rate, source_url: "https://www.colegiocpa.com/colegiados/tipos-contributivos/" }));
TABLES.zillow_market = ZILLOW_MARKET;
TABLES.crim_tax_rates = [...crim("Bayamón", 9.58, 7.58), ...crim("San Juan", 10.83, 8.83), ...crim("Ponce", 10.33, 8.33)];
TABLES.watchlist = [
  { id: "90000000-0000-4000-8000-000000000001", owner_id: USER.id, zillow_id: String(ZILLOW_MARKET[8].id), price: 225000, beds: 3, baths: 2, street: "Calle Demo 9", city: "Bayamon", state: "PR", img_src: "https://photos.zillowstatic.com/demo.jpg", detail_url: ZILLOW_MARKET[8].detailUrl, home_type: "SINGLE_FAMILY", home_status: "FOR_SALE", saved_at: ts(-4) },
];
TABLES.investment_analyses = [];

// ── Plan 33: ATH Móvil ──
// The first ledger payment came in through the portal; the landlord has ATH
// Business connected; the demo user also redeemed a tenant invite for C1 so
// /portal renders when the session carries app_role "tenant".
TABLES.payments[0] = { ...TABLES.payments[0], source: "ath_movil", external_id: "athm:ATH-48213" };
TABLES.ath_movil_accounts = [{ owner_id: USER.id, public_token_enc: "enc:v1:mock", private_token_enc: null, business_name: "Rivera Propiedades", connected_at: ts(-30), updated_at: ts(-30) }];
TABLES.ath_movil_payments = [];
TABLES.tenant_invites = [
  { id: "f0000000-0000-4000-8000-000000000001", contract_id: C1, owner_id: USER.id, tenant_email: T1.email, token: "demo-invite-token", used: true, used_by: USER.id, used_at: ts(-280), created_at: ts(-290), expires_at: ts(-270) },
];

// ── Plan 39: AI drafting ────────────────────────────────────────────────────
// A clause in the settings library to translate; AI usage starts empty.
TABLES.user_section_templates = [
  { id: "e3900000-0000-4000-8000-000000000001", owner_id: USER.id, title: "Mascotas", body: "No se permiten mascotas en la propiedad sin la autorización escrita del arrendador.", created_at: ts(-30) },
];
TABLES.ai_usage_events = [];

// RPC results (POST /rest/v1/rpc/<name>).
export const RPCS = {
  market_data_updated_at: ts(-3),
  ath_movil_status: [{ connected: true, business_name: "Rivera Propiedades", connected_at: ts(-30) }],
};
