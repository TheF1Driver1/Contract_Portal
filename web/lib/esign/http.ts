import { NextResponse } from "next/server";
import { SignError } from "./service";

const MESSAGES: Record<string, string> = {
  not_found: "Contrato no encontrado.",
  not_requestable: "Este contrato no admite una nueva solicitud de firma.",
  no_tenant: "Añade un inquilino al contrato antes de pedir la firma.",
  signer_unreachable: "Cada firmante necesita un correo electrónico o un teléfono.",
  already_signed: "Este contrato ya está firmado.",
  not_voidable: "Solo puedes anular contratos enviados o firmados.",
  invalid_link: "Este enlace de firma no es válido.",
  link_revoked: "Este enlace fue reemplazado. Pide al arrendador uno nuevo.",
  link_expired: "Este enlace venció. Pide al arrendador uno nuevo.",
  contract_voided: "Este contrato fue anulado.",
  not_open: "Este contrato no está disponible para firmar.",
  declined: "Rechazaste firmar este contrato.",
  channel_unavailable: "No hay un contacto para ese método.",
  code_missing: "Pide un código primero.",
  code_locked: "Demasiados intentos. Pide un código nuevo.",
  code_expired: "El código venció. Pide uno nuevo.",
  code_wrong: "El código no es correcto.",
  consent_required: "Acepta el uso de firma electrónica para continuar.",
  verification_required: "Verifica tu identidad para continuar.",
  contract_changed: "El contrato cambió después de enviarse. Pide al arrendador que lo envíe de nuevo.",
  not_your_turn: "Otra persona debe firmar antes que tú. Te avisaremos.",
  signature_invalid: "La firma no es válida. Inténtalo de nuevo.",
};

/** Maps service errors to JSON responses with a Spanish message and a stable code. */
export function signErrorResponse(err: unknown) {
  if (err instanceof SignError) {
    return NextResponse.json({ error: MESSAGES[err.code] ?? err.code, code: err.code }, { status: err.status });
  }
  console.error(JSON.stringify({ level: "error", msg: "esign failure", err: String(err) }));
  return NextResponse.json({ error: "Algo salió mal. Inténtalo de nuevo.", code: "server_error" }, { status: 500 });
}

export { MESSAGES as SIGN_ERROR_MESSAGES };
