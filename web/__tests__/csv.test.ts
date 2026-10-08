import { describe, expect, it } from "vitest";
import { mapRows, parseCsv, PROPERTY_ALIASES, TENANT_ALIASES } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, commas, newlines in fields, CRLF and BOM", () => {
    const rows = parseCsv('﻿nombre,dirección\r\n"Casa ""Azul""","Calle 1, Apt 2"\r\n\r\n"Línea\nDos",x\n');
    expect(rows).toEqual([["nombre", "dirección"], ['Casa "Azul"', "Calle 1, Apt 2"], ["Línea\nDos", "x"]]);
  });
  it("detects semicolon-delimited files (Excel in Spanish)", () => {
    expect(parseCsv("nombre;ciudad\nCasa;Dorado")).toEqual([["nombre", "ciudad"], ["Casa", "Dorado"]]);
  });
});

describe("mapRows", () => {
  it("maps Spanish or English headers, accents and case ignored", () => {
    const props = mapRows(parseCsv("Nombre,Dirección,Pueblo,Unidades\nCasa,Calle 1,Dorado,3"), PROPERTY_ALIASES);
    expect(props).toEqual([{ name: "Casa", address: "Calle 1", city: "Dorado", unit_count: "3" }]);
    const tenants = mapRows(parseCsv("Full Name,Email,Teléfono\nAna,ana@x.com,787-555-0101"), TENANT_ALIASES);
    expect(tenants).toEqual([{ full_name: "Ana", email: "ana@x.com", phone: "787-555-0101" }]);
  });
});
