import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import ContractBuilder from "@/components/ContractBuilder";
import common from "@/messages/es/common.json";
import builder from "@/messages/es/builder.json";
import type { Property, Tenant } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/actions/contracts", () => ({ saveContract: vi.fn(async () => ({ ok: true, id: "c1" })) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));
vi.mock("@/components/SignaturePad", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
globalThis.fetch = vi.fn(async () => new Response("[]")) as unknown as typeof fetch;
Element.prototype.scrollIntoView = vi.fn();

const properties = [
  { id: "p1", owner_id: "u1", name: "Sabana Gardens", address: "456 Oak", unit: null, city: "San Juan", state: "PR", zip: "00901", country: null, jurisdiction: "pr", unit_count: 5, bathroom_count: 1, parking_available: false, parking_count: null, created_at: "" },
] as Property[];
const tenants = [{ id: "t1", owner_id: "u1", full_name: "Jane Smith", email: "jane@example.com" }] as Tenant[];

function setup() {
  return render(
    <NextIntlClientProvider locale="es" messages={{ common, builder }} timeZone="America/Puerto_Rico">
      <ContractBuilder properties={properties} tenants={tenants} templates={[]} userId="u1" landlordEmail="l@example.com" />
    </NextIntlClientProvider>
  );
}

describe("ContractBuilder 4-step flow", () => {
  it("starts on Partes y propiedad with all 4 steps listed", () => {
    setup();
    for (const s of ["Partes y propiedad", "Términos", "Cláusulas", "Revisar y enviar"]) {
      expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
  });

  it("blocks Siguiente until property and tenant are chosen", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(await screen.findByText("Selecciona la propiedad.")).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
  });

  it("Atrás is disabled on the first step", () => {
    setup();
    expect(screen.getByRole("button", { name: /atrás/i })).toBeDisabled();
  });

  it("renders the lease preview with Spanish governing law", () => {
    setup();
    expect(screen.getAllByText(/Código Civil de Puerto Rico de 2020/).length).toBeGreaterThan(0);
  });
});
