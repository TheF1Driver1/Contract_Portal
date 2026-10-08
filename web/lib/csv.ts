/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, BOM, ; or , delimiter. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const normalize = (h: string) =>
  h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Maps CSV rows to objects using header aliases (Spanish or English).
 * Unknown columns are ignored.
 */
export function mapRows(rows: string[][], aliases: Record<string, string[]>): Record<string, string>[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(normalize);
  const index: Record<string, number> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const i = header.findIndex((h) => names.map(normalize).includes(h));
    if (i >= 0) index[field] = i;
  }
  return rows.slice(1).map((r) =>
    Object.fromEntries(Object.entries(index).map(([field, i]) => [field, (r[i] ?? "").trim()]))
  );
}

export const PROPERTY_ALIASES: Record<string, string[]> = {
  name: ["name", "nombre", "propiedad", "property"],
  address: ["address", "direccion", "dirección", "calle"],
  city: ["city", "ciudad", "pueblo", "municipio"],
  state: ["state", "estado"],
  zip: ["zip", "zipcode", "codigo postal", "código postal", "zona postal"],
  unit_count: ["units", "unidades", "unit count"],
  bathroom_count: ["bathrooms", "banos", "baños"],
};

export const TENANT_ALIASES: Record<string, string[]> = {
  full_name: ["name", "full name", "nombre", "nombre completo", "inquilino", "tenant"],
  email: ["email", "correo", "correo electronico", "correo electrónico", "e-mail"],
  phone: ["phone", "telefono", "teléfono", "celular", "movil", "móvil"],
  license_number: ["license", "licencia", "identificacion", "identificación", "id"],
  current_address: ["address", "direccion", "dirección", "direccion actual"],
  preferred_locale: ["language", "idioma"],
};
