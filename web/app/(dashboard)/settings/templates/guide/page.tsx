import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

const VARIABLES = [
  // Date
  { name: "dia",   category: "Date",    maps_to: "Day the contract is generated", required: true,  example: "15" },
  { name: "mes",   category: "Date",    maps_to: "Month (Spanish)", required: true, example: "enero" },
  { name: "anio",  category: "Date",    maps_to: "Year",             required: true, example: "2025" },

  // Tenant
  { name: "nombre_arrendatario", category: "Tenant", maps_to: "Tenant full name",   required: true,  example: "Juan García" },
  { name: "seguro_social",       category: "Tenant", maps_to: "SSN (xxx-xx-XXXX)", required: false, example: "xxx-xx-1234" },
  { name: "numero_licencia",     category: "Tenant", maps_to: "Driver's license #", required: false, example: "B1234567" },
  { name: "residencia_actual",   category: "Tenant", maps_to: "Current address",    required: false, example: "123 Calle Sol, San Juan" },

  // Property
  { name: "cantidad_cuartos",          category: "Property", maps_to: "Number of bedrooms",     required: true,  example: "2" },
  { name: "cantidad_abanicos_techo",   category: "Property", maps_to: "Ceiling fans count",      required: false, example: "3" },
  { name: "cantidad_estufas",          category: "Property", maps_to: "Stoves count",            required: false, example: "1" },
  { name: "cantidad_stools",           category: "Property", maps_to: "Bar stools count",        required: false, example: "2" },

  // Amenities (✔ or __________)
  { name: "tiene_puertas_de_espejo",   category: "Amenities", maps_to: "Mirror doors (✔ / blank)",       required: false, example: "✔" },
  { name: "tiene_bano_remodelado",     category: "Amenities", maps_to: "Renovated bathroom",             required: false, example: "__________" },
  { name: "tiene_microondas",          category: "Amenities", maps_to: "Microwave included",             required: false, example: "✔" },
  { name: "tiene_nevera",              category: "Amenities", maps_to: "Refrigerator included",          required: false, example: "✔" },
  { name: "tiene_aire_acondicionado",  category: "Amenities", maps_to: "Air conditioning",               required: false, example: "__________" },
  { name: "tiene_cortinas_miniblinds", category: "Amenities", maps_to: "Mini-blinds",                   required: false, example: "✔" },
  { name: "tiene_sofa",                category: "Amenities", maps_to: "Sofa included",                 required: false, example: "__________" },
  { name: "tiene_futton",              category: "Amenities", maps_to: "Futon included",                required: false, example: "__________" },
  { name: "tiene_cuadros",             category: "Amenities", maps_to: "Wall art included",             required: false, example: "__________" },
  { name: "incluye_estacionamiento",   category: "Amenities", maps_to: "Parking included",              required: false, example: "✔" },

  // Occupants
  { name: "cantidad_personas", category: "Occupants", maps_to: "Total occupant count", required: true, example: "2" },

  // Lease dates
  { name: "cantidad_de_anios_contrato",  category: "Lease", maps_to: "Lease length in years",  required: true,  example: "1" },
  { name: "cantidad_de_meses_contrato",  category: "Lease", maps_to: "Lease length in months", required: true,  example: "12" },
  { name: "dia_comienzo_contrato",       category: "Lease", maps_to: "Start day",               required: true,  example: "1" },
  { name: "mes_comienzo_contrato",       category: "Lease", maps_to: "Start month (Spanish)",   required: true,  example: "enero" },
  { name: "anio_comienzo_contrato",      category: "Lease", maps_to: "Start year",              required: true,  example: "2025" },
  { name: "dia_que_culmina_contrato",    category: "Lease", maps_to: "End day",                 required: true,  example: "31" },
  { name: "mes_que_culmina_contrato",    category: "Lease", maps_to: "End month (Spanish)",     required: true,  example: "diciembre" },
  { name: "anio_que_culmina_contrato",   category: "Lease", maps_to: "End year",                required: true,  example: "2025" },

  // Payment
  { name: "canon_arrendamiento_numero", category: "Payment", maps_to: "Monthly rent (numeric)", required: true,  example: "1200" },
  { name: "canon_arrendamiento_verbal", category: "Payment", maps_to: "Monthly rent (written)", required: false, example: "mil doscientos" },
  { name: "cantidad_pago_firma",        category: "Payment", maps_to: "Security deposit",       required: true,  example: "1200" },
  { name: "dia_pago_tarde",             category: "Payment", maps_to: "Late fee day of month",  required: true,  example: "5" },

  // Keys & signatures
  { name: "cantidad_llaves",    category: "Other", maps_to: "Number of keys given",  required: false, example: "2" },
  { name: "firma_arrendador",   category: "Other", maps_to: "Landlord signature image or blank line", required: false, example: "(signature)" },
  { name: "firma_arrendatario", category: "Other", maps_to: "Tenant signature image or blank line",   required: false, example: "(signature)" },
];

const CATEGORIES = ["Date", "Tenant", "Property", "Amenities", "Occupants", "Lease", "Payment", "Other"];

const S = {
  border: "rgba(255,255,255,0.07)",
  surface: "var(--surface-low)",
  surfaceMid: "var(--surface-mid)",
  muted: "var(--text-muted)",
  secondary: "var(--text-secondary)",
  text: "var(--text-primary)",
  accent: "#007aff",
};

export default function VariableGuidePage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/settings/templates"
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-3"
            style={{ color: S.muted }}
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Templates
          </Link>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: S.text }}>
            Template Variable Guide
          </h1>
          <p className="text-sm mt-1" style={{ color: S.muted }}>
            Use these placeholders in your .docx template. Wrap each variable in double curly braces:{" "}
            <code
              className="rounded px-1.5 py-0.5 text-xs font-mono"
              style={{ background: "var(--surface-mid)", color: S.accent }}
            >
              {"{"}{"{"} variable_name {"}"}{"}"}
            </code>
          </p>
        </div>
        <a
          href="/templates/contract_template.docx"
          download
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shrink-0 transition-colors"
          style={{
            background: "rgba(0,122,255,0.12)",
            color: S.accent,
            border: `1px solid rgba(0,122,255,0.25)`,
          }}
        >
          <Download className="h-4 w-4" />
          Starter Template
        </a>
      </div>

      {/* Usage instructions */}
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{ background: S.surface, border: `1px solid ${S.border}` }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
          How to use
        </p>
        <ol className="space-y-2 text-sm" style={{ color: S.secondary }}>
          <li>1. Open your lease document in Microsoft Word or Google Docs.</li>
          <li>
            2. Replace the values you want filled automatically with{" "}
            <code
              className="rounded px-1 py-0.5 text-xs font-mono"
              style={{ background: "var(--surface-mid)", color: S.accent }}
            >
              {"{{nombre_arrendatario}}"}
            </code>{" "}
            — using the variable names from the table below.
          </li>
          <li>3. Save the file as <strong>.docx</strong> (Word format).</li>
          <li>4. Upload via Settings → Templates.</li>
          <li>
            5. When generating a contract, the system fills every{" "}
            <code
              className="rounded px-1 py-0.5 text-xs font-mono"
              style={{ background: "var(--surface-mid)", color: S.accent }}
            >
              {"{{variable}}"}
            </code>{" "}
            with real data.
          </li>
        </ol>
        <p className="text-xs" style={{ color: S.muted }}>
          Amenity checkboxes render as <strong>✔</strong> when the amenity is selected, or{" "}
          <strong>__________</strong> when not.
          Signatures render as the captured image when both parties have signed.
        </p>
      </div>

      {/* Variable tables by category */}
      {CATEGORIES.map(cat => {
        const vars = VARIABLES.filter(v => v.category === cat);
        return (
          <div
            key={cat}
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${S.border}` }}
          >
            <div
              className="px-5 py-3"
              style={{ background: S.surface, borderBottom: `1px solid ${S.border}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                {cat}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: S.surfaceMid, borderBottom: `1px solid ${S.border}` }}>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: S.muted, width: "32%" }}>
                    Variable
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: S.muted, width: "40%" }}>
                    Maps to
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: S.muted, width: "14%" }}>
                    Example
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: S.muted, width: "14%" }}>
                    Required
                  </th>
                </tr>
              </thead>
              <tbody>
                {vars.map((v, i) => (
                  <tr
                    key={v.name}
                    style={{
                      borderBottom: i < vars.length - 1 ? `1px solid ${S.border}` : "none",
                    }}
                  >
                    <td className="px-4 py-3">
                      <code
                        className="rounded px-1.5 py-0.5 text-xs font-mono"
                        style={{ background: "rgba(0,122,255,0.08)", color: S.accent }}
                      >
                        {"{{"}{v.name}{"}}"}
                      </code>
                    </td>
                    <td className="px-4 py-3" style={{ color: S.secondary }}>
                      {v.maps_to}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: S.muted }}>
                      {v.example}
                    </td>
                    <td className="px-4 py-3">
                      {v.required ? (
                        <span
                          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(0,122,255,0.12)", color: S.accent }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                          style={{ background: S.surfaceMid, color: S.muted }}
                        >
                          Optional
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
