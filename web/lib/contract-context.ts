import type { Contract } from "@/lib/types";

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

  return {
    dia:  String(today.getDate()),
    mes:  MONTHS_ES[today.getMonth() + 1],
    anio: String(today.getFullYear()),

    nombre_arrendatario: contract.tenant?.full_name ?? "",
    seguro_social:       contract.tenant?.ssn_last4 ? `xxx-xx-${contract.tenant.ssn_last4}` : "xxx-xx-xxxx",
    numero_licencia:     contract.tenant?.license_number ?? "",
    residencia_actual:   contract.tenant?.current_address ?? "",

    cantidad_cuartos:          String(amenities.room_count ?? 1),
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
    incluye_estacionamiento:   check(Boolean(amenities.parking)),

    cantidad_personas: String(contract.occupant_count),

    // UTC dates to avoid timezone shift on YYYY-MM-DD strings
    cantidad_de_anios_contrato:  String(Math.floor(contract.lease_months / 12)),
    cantidad_de_meses_contrato:  String(contract.lease_months),
    dia_comienzo_contrato:       String(start.getUTCDate()),
    mes_comienzo_contrato:       MONTHS_ES[start.getUTCMonth() + 1],
    anio_comienzo_contrato:      String(start.getUTCFullYear()),
    dia_que_culmina_contrato:    String(end.getUTCDate()),
    mes_que_culmina_contrato:    MONTHS_ES[end.getUTCMonth() + 1],
    anio_que_culmina_contrato:   String(end.getUTCFullYear()),

    canon_arrendamiento_numero: String(contract.rent_amount),
    canon_arrendamiento_verbal: contract.rent_amount_verbal ?? "",
    cantidad_pago_firma:        String(contract.security_deposit),
    dia_pago_tarde:             String(contract.late_fee_day),

    cantidad_llaves:    String(contract.key_count),
    firma_arrendador:   contract.landlord_signature ? SIG_LANDLORD : "_________________________",
    firma_arrendatario: contract.tenant_signature   ? SIG_TENANT   : "_________________________",
  };
}
