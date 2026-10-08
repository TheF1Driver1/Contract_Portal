import type { Contract, ContractFormValues, GoverningLaw, Jurisdiction } from "@/lib/types";

export type LocalSection = { title: string; body: string };

export const STEP_KEYS = ["parties", "terms", "clauses", "review"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

/** Fields validated with `trigger` before leaving each step. */
export const STEP_FIELDS: Record<number, (keyof ContractFormValues)[]> = {
  0: ["property_id", "tenant_id", "occupant_count"],
  1: ["lease_start", "lease_end", "lease_months", "rent_amount", "payment_due_day"],
  2: [],
  3: [],
};

/** Step that owns a field, used to jump to the first error on submit. */
export function stepForField(name: string): number {
  for (const [step, fields] of Object.entries(STEP_FIELDS)) {
    if ((fields as string[]).includes(name)) return Number(step);
  }
  return 0;
}

/** Boolean amenities shown as a generic checklist (existing columns). */
export const AMENITY_FLAGS = [
  "fridge",
  "microwave",
  "ac",
  "mini_blinds",
  "mirror_doors",
  "renovated_bathroom",
  "sofa",
  "futon",
  "wall_art",
] as const satisfies readonly (keyof ContractFormValues)[];

/** Inventory counts stored in `amenities`. */
export const COUNT_FIELDS = [
  { name: "room_count", min: 1 },
  { name: "bathroom_count", min: 1 },
  { name: "fan_count", min: 0 },
  { name: "stool_count", min: 0 },
  { name: "stove_count", min: 0 },
] as const satisfies readonly { name: keyof ContractFormValues; min: number }[];

export const toNumberOrUndefined = (v: unknown) =>
  v === "" || v == null || isNaN(Number(v)) ? undefined : Number(v);

export const DEFAULT_VALUES: ContractFormValues = {
  contract_type: "lease",
  property_id: "",
  unit_number: "",
  jurisdiction: "pr",
  tenant_id: "",
  lease_start: "",
  lease_end: "",
  lease_months: 12,
  rent_amount: undefined,
  rent_amount_verbal: "",
  security_deposit: undefined,
  payment_due_day: 1,
  late_fee_day: 5,
  occupant_names: "",
  occupant_count: 1,
  room_count: 2,
  fan_count: 2,
  stool_count: 2,
  stove_count: 1,
  key_count: 2,
  mirror_doors: false,
  renovated_bathroom: false,
  microwave: false,
  fridge: true,
  ac: false,
  mini_blinds: false,
  sofa: false,
  futon: false,
  wall_art: false,
  parking: false,
  bathroom_count: 1,
  parking_available: false,
  parking_count: 1,
  parking_spot: "",
  custom_amenities: "",
  late_fee_type: "fixed",
  late_fee_grace_period_days: 0,
  late_fee_fixed_amount: undefined,
  late_fee_daily_amount: undefined,
  template_id: "",
  landlord_signature: "",
  tenant_signature: "",
  send_email: false,
  send_sms: false,
  recipient_email: "",
  recipient_phone: "",
};

const LAW_TO_JURISDICTION: Record<GoverningLaw, Jurisdiction> = {
  codigo_civil_pr_2020: "pr",
  us_state: "us_mainland",
  other: "other",
};

export function jurisdictionToLaw(j: Jurisdiction | undefined): GoverningLaw {
  return j === "pr" ? "codigo_civil_pr_2020" : j === "us_mainland" ? "us_state" : "other";
}

/** Form values for an existing draft. */
export function valuesFromContract(d: Contract): ContractFormValues {
  const am = (d.amenities ?? {}) as Record<string, string | number | boolean>;
  return {
    ...DEFAULT_VALUES,
    contract_type: d.contract_type ?? "lease",
    property_id: d.property_id ?? "",
    unit_number: d.unit_number ?? "",
    jurisdiction: d.governing_law ? LAW_TO_JURISDICTION[d.governing_law] ?? "pr" : "pr",
    tenant_id: d.tenant_id ?? "",
    lease_start: d.lease_start ?? "",
    lease_end: d.lease_end ?? "",
    lease_months: d.lease_months ?? 12,
    rent_amount: d.rent_amount || undefined,
    rent_amount_verbal: d.rent_amount_verbal ?? "",
    security_deposit: d.security_deposit || undefined,
    payment_due_day: d.payment_due_day ?? 1,
    late_fee_day: d.late_fee_day ?? 5,
    occupant_names: (d.occupant_names ?? []).join(", "),
    occupant_count: d.occupant_count ?? 1,
    room_count: (am.room_count as number) ?? 2,
    fan_count: (am.fan_count as number) ?? 2,
    stool_count: (am.stool_count as number) ?? 2,
    stove_count: (am.stove_count as number) ?? 1,
    key_count: d.key_count ?? 2,
    mirror_doors: Boolean(am.mirror_doors),
    renovated_bathroom: Boolean(am.renovated_bathroom),
    microwave: Boolean(am.microwave),
    fridge: am.fridge !== false,
    ac: Boolean(am.ac),
    mini_blinds: Boolean(am.mini_blinds),
    sofa: Boolean(am.sofa),
    futon: Boolean(am.futon),
    wall_art: Boolean(am.wall_art),
    parking: Boolean(am.parking),
    bathroom_count: 1,
    parking_available: Boolean(am.parking),
    parking_count: (am.parking_count as number) ?? 1,
    parking_spot: (am.parking_spot as string) ?? "",
    custom_amenities: (am.custom_amenities as string) ?? "",
    late_fee_type: d.late_fee_type ?? "fixed",
    late_fee_grace_period_days: d.late_fee_grace_period_days ?? 0,
    late_fee_fixed_amount: d.late_fee_fixed_amount || undefined,
    late_fee_daily_amount: d.late_fee_daily_amount || undefined,
    template_id: d.template_id ?? "",
    landlord_signature: d.landlord_signature ?? "",
    tenant_signature: d.tenant_signature ?? "",
  };
}

/** Contract row sent to `saveContract` (same mapping as before the redesign). */
export function contractPayload(data: ContractFormValues) {
  const amenities = {
    room_count: data.room_count,
    fan_count: data.fan_count,
    stool_count: data.stool_count,
    stove_count: data.stove_count,
    mirror_doors: data.mirror_doors,
    renovated_bathroom: data.renovated_bathroom,
    microwave: data.microwave,
    fridge: data.fridge,
    ac: data.ac,
    mini_blinds: data.mini_blinds,
    sofa: data.sofa,
    futon: data.futon,
    wall_art: data.wall_art,
    parking: data.parking_available,
    parking_spot: data.parking_spot || null,
    custom_amenities: data.custom_amenities || null,
  };

  return {
    property_id: data.property_id,
    tenant_id: data.tenant_id,
    contract_type: data.contract_type,
    unit_number: data.unit_number || null,
    lease_start: data.lease_start,
    lease_end: data.lease_end,
    lease_months: data.lease_months,
    rent_amount: data.rent_amount,
    rent_amount_verbal: data.rent_amount_verbal || null,
    security_deposit: data.security_deposit || 0,
    payment_due_day: data.payment_due_day,
    late_fee_day: Math.min(31, (data.payment_due_day ?? 1) + (data.late_fee_grace_period_days ?? 0)),
    occupant_names: data.occupant_names
      ? data.occupant_names.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    occupant_count: data.occupant_count,
    amenities,
    key_count: data.key_count,
    template_id: data.template_id || null,
    landlord_signature: data.landlord_signature || null,
    tenant_signature: data.tenant_signature || null,
    late_fee_type: data.late_fee_type,
    late_fee_grace_period_days: data.late_fee_grace_period_days,
    late_fee_fixed_amount: data.late_fee_fixed_amount || 0,
    late_fee_daily_amount: data.late_fee_daily_amount || 0,
    governing_law: jurisdictionToLaw(data.jurisdiction),
  };
}

/** YYYY-MM-DD plus N months, computed in UTC so the day never shifts. */
export function addMonths(start: string, months: number): string | null {
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d || !Number.isFinite(months)) return null;
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** Date-only strings parsed at noon so formatting never shifts a day. */
export const dateOnly = (d: string) => new Date(d + "T12:00:00");
