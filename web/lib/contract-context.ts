import type { Contract, Property, Tenant, TenantSnapshot, PropertySnapshot } from "@/lib/types";

export const MONTHS_ES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const SIG_LANDLORD = "[[LANDLORD_SIGNATURE]]";
export const SIG_TENANT   = "[[TENANT_SIGNATURE]]";

export function check(val: boolean | undefined): string {
  return val ? "✔" : "__________";
}

export function buildContext(contract: Contract) {
  const amenities = (contract.amenities ?? {}) as Record<string, boolean | number>;
  const start  = new Date(contract.lease_start);
  const end    = new Date(contract.lease_end);
  const today  = new Date();

  // Prefer snapshots for legal immutability; fall back to live joined data
  const tenant = (contract.tenant_snapshot ?? contract.tenant ?? null) as
    | TenantSnapshot | Tenant | null;
  const property = (contract.property_snapshot ?? contract.property ?? null) as
    | PropertySnapshot | Property | null;

  function buildLateFeeDesc(): string {
    const grace = contract.late_fee_grace_period_days ?? 0;
    const type  = contract.late_fee_type ?? 'fixed';
    const fixed = contract.late_fee_fixed_amount ?? 0;
    const daily = contract.late_fee_daily_amount ?? 0;
    const parts: string[] = [];
    if (grace > 0) parts.push(`después de ${grace} día(s) de gracia`);
    if (type === 'fixed' || type === 'both') parts.push(`cargo fijo de $${fixed}`);
    if (type === 'daily' || type === 'both') parts.push(`$${daily} por día`);
    return parts.join(', ') || `cargo de mora después del día ${contract.late_fee_day}`;
  }

  const prop = property as { bathroom_count?: number; parking_available?: boolean; parking_count?: number | null; name?: string; address?: string; city?: string; state?: string } | null;
  const ten  = tenant  as { full_name?: string; ssn_last4?: string | null; license_number?: string | null; current_address?: string | null; date_of_birth?: string | null; employer_name?: string | null } | null;

  return {
    // ── Document date ──
    dia:  String(today.getDate()),
    mes:  MONTHS_ES[today.getMonth() + 1],
    anio: String(today.getFullYear()),

    // ── Tenant ──
    nombre_arrendatario: ten?.full_name ?? "",
    seguro_social:       ten?.ssn_last4
                           ? `xxx-xx-${ten.ssn_last4}`
                           : "xxx-xx-xxxx",
    numero_licencia:     ten?.license_number ?? "",
    residencia_actual:   ten?.current_address ?? "",
    fecha_nacimiento:    ten?.date_of_birth ?? "",
    empleador:           ten?.employer_name ?? "",

    // ── Amenities / counts ──
    cantidad_cuartos:          String(amenities.room_count ?? 1),
    cantidad_banos:            String(prop?.bathroom_count ?? 1),
    tiene_puertas_de_espejo:   check(Boolean(amenities.mirror_doors)),
    cantidad_abanicos_techo:   String(amenities.fan_count ?? 0),
    tiene_bano_remodelado:     check(Boolean(amenities.renovated_bathroom)),
    cantidad_estufas:          String(amenities.stove_count ?? 1),
    tiene_microondas:          check(Boolean(amenities.microwave)),
    tiene_nevera:              check(Boolean(amenities.fridge)),
    tiene_aire_acondicionado:  check(Boolean(amenities.ac)),
    cantidad_stools:           String(amenities.stool_count ?? 0),
    tiene_cortinas_miniblinds: check(Boolean(amenities.mini_blinds)),
    tiene_sofa:                check(Boolean(amenities.sofa)),
    tiene_futton:              check(Boolean(amenities.futon)),
    tiene_cuadros:             check(Boolean(amenities.wall_art)),
    incluye_estacionamiento:   check(Boolean(
      prop?.parking_available ?? Boolean(amenities.parking)
    )),
    cantidad_estacionamientos: String(prop?.parking_count ?? 0),
    numero_estacionamiento:    String(amenities.parking_spot ?? ""),

    // ── Occupants ──
    cantidad_personas: String(contract.occupant_count),
    nombres_ocupantes: (contract.occupant_names ?? []).join(", "),

    // ── Lease dates ──
    cantidad_de_anios_contrato:  String(Math.floor(contract.lease_months / 12)),
    cantidad_de_meses_contrato:  String(contract.lease_months),
    dia_comienzo_contrato:       String(start.getUTCDate()),
    mes_comienzo_contrato:       MONTHS_ES[start.getUTCMonth() + 1],
    anio_comienzo_contrato:      String(start.getUTCFullYear()),
    dia_que_culmina_contrato:    String(end.getUTCDate()),
    mes_que_culmina_contrato:    MONTHS_ES[end.getUTCMonth() + 1],
    anio_que_culmina_contrato:   String(end.getUTCFullYear()),

    // ── Payment ──
    canon_arrendamiento_numero: String(contract.rent_amount),
    canon_arrendamiento_verbal: contract.rent_amount_verbal ?? "",
    cantidad_pago_firma:        String(contract.security_deposit),
    dia_pago_mensual:           String(contract.payment_due_day),
    dia_pago_tarde:             String(contract.late_fee_day),

    // ── Late fees ──
    tipo_cargo_mora:   contract.late_fee_type ?? 'fixed',
    dias_gracia:       String(contract.late_fee_grace_period_days ?? 0),
    cargo_mora_fijo:   String(contract.late_fee_fixed_amount ?? 0),
    cargo_mora_diario: String(contract.late_fee_daily_amount ?? 0),
    descripcion_mora:  buildLateFeeDesc(),

    // ── Property ──
    nombre_propiedad:    prop?.name ?? "",
    direccion_propiedad: prop?.address ?? "",
    ciudad_propiedad:    prop?.city ?? "",
    estado_propiedad:    prop?.state ?? "",

    // ── Keys / Signatures ──
    cantidad_llaves:    String(contract.key_count),
    firma_arrendador:   contract.landlord_signature ? SIG_LANDLORD : "_________________________",
    firma_arrendatario: contract.tenant_signature   ? SIG_TENANT   : "_________________________",
  };
}
