// Puerto Rico lease terminology used to keep AI clause translations
// consistent. NOT reviewed by an attorney yet: the UI says so while
// `reviewed` is false. Change a term here, never in the prompt.

export type GlossaryTerm = { es: string; en: string; note?: string };

export const GLOSSARY: { reviewed: boolean; terms: readonly GlossaryTerm[] } = {
  reviewed: false,
  terms: [
    { es: "arrendador", en: "landlord", note: "lessor in formal contexts" },
    { es: "arrendatario", en: "tenant", note: "lessee in formal contexts" },
    { es: "contrato de arrendamiento", en: "lease agreement" },
    { es: "canon de arrendamiento", en: "rent", note: "also 'renta'; monthly rent = canon mensual" },
    { es: "fianza", en: "security deposit", note: "also 'depósito de seguridad'" },
    { es: "fiador", en: "guarantor" },
    { es: "desahucio", en: "eviction", note: "a court proceeding; never use for a simple notice to vacate" },
    { es: "Código Civil de Puerto Rico de 2020", en: "Puerto Rico Civil Code of 2020", note: "Act 55-2020; keep the name, do not substitute U.S. state law" },
    { es: "inmueble", en: "premises", note: "or 'property' when referring to the building" },
    { es: "vivienda", en: "dwelling" },
    { es: "subarrendamiento", en: "sublease" },
    { es: "cesión del contrato", en: "assignment of the lease" },
    { es: "término", en: "term", note: "duration of the lease; 'plazo' for a deadline" },
    { es: "prórroga", en: "extension" },
    { es: "renovación", en: "renewal" },
    { es: "tácita reconducción", en: "implied renewal (tácita reconducción)", note: "keep the Spanish term in parentheses" },
    { es: "recargo por demora", en: "late fee" },
    { es: "mora", en: "late payment", note: "'en mora' = in default on payment" },
    { es: "utilidades", en: "utilities", note: "keep agency names as is: LUMA, AAA" },
    { es: "reparaciones necesarias", en: "necessary repairs" },
    { es: "mejoras", en: "improvements" },
    { es: "inventario", en: "inventory", note: "list of furnishings and condition at move-in" },
    { es: "notificación por escrito", en: "written notice" },
    { es: "resolución del contrato", en: "termination of the lease", note: "termination for breach; 'rescisión' is a different remedy, keep it as 'rescission'" },
    { es: "ocupantes", en: "occupants" },
    { es: "daños y perjuicios", en: "damages" },
    { es: "Tribunal de Primera Instancia", en: "Court of First Instance" },
    { es: "CRIM", en: "CRIM", note: "Municipal Revenue Collection Center; keep the acronym" },
  ],
};

/** The glossary as prompt text, one term per line. Stable order keeps the prompt cacheable. */
export function glossaryPrompt(): string {
  return GLOSSARY.terms.map((t) => `- ${t.es} = ${t.en}${t.note ? ` (${t.note})` : ""}`).join("\n");
}
