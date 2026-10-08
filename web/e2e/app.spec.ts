import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInMock } from "./mock/session";

// Signed-in screens against the mock Supabase (e2e/mock/server.mjs).
// Runs when the app was built with NEXT_PUBLIC_SUPABASE_URL pointing at the mock.
const MOCK_URL = process.env.MOCK_SUPABASE_URL;

const PAGES = [
  { path: "/dashboard", heading: "Inicio" },
  { path: "/contracts", heading: "Contratos" },
  { path: "/contracts/new", heading: "Nuevo contrato" },
  { path: "/properties", heading: "Propiedades" },
  { path: "/tenants", heading: "Inquilinos" },
  { path: "/expenses", heading: "Gastos" },
  { path: "/rent", heading: "Cobros" },
  { path: "/contracts/30000000-0000-4000-8000-000000000001", heading: "José Martínez · Edificio Las Palmas 2B" },
];

test.describe("signed-in app", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");

  for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme });

      for (const { path, heading } of PAGES) {
        test(`${path} renders and has no serious a11y violations`, async ({ page, context, baseURL }) => {
          await signInMock(context, baseURL!, MOCK_URL!);
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .exclude(".leaflet-container")
            .analyze();
          const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
        });
      }
    });
  }
});

test.describe("signing ceremony (no account)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");
  const TOKEN = "demoSigningToken_000000000000000000000000000000";

  for (const scheme of ["light", "dark"] as const) {
    test(`consent step renders accessibly (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/sign/${TOKEN}`);
      await expect(page.getByRole("heading", { level: 1, name: "Firma electrónica" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
      await page.getByRole("checkbox").check();
      await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => v.id)).toEqual([]);
    });
  }

  test("an unknown link explains itself", async ({ page }) => {
    await page.goto("/sign/not-a-real-token");
    await expect(page.getByRole("heading", { name: "No podemos abrir este enlace" })).toBeVisible();
  });
});

test.describe("rent ledger", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");

  test("shows the balance and opens the payment form", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/contracts/30000000-0000-4000-8000-000000000001");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Renta y pagos" }) });
    await expect(section.getByText("Vencido")).toBeVisible();
    await expect(section.getByText("$1,200").first()).toBeVisible();
    await expect(section.getByText(/Pago · Cheque · Cheque 1187/)).toBeVisible();
    await section.getByRole("button", { name: "Registrar pago" }).click();
    const sheet = page.getByRole("dialog", { name: "Registrar pago" });
    await expect(sheet.getByLabel("Cantidad")).toHaveValue("1200");
    await expect(sheet.getByLabel("Enviar recibo al inquilino por correo")).toBeChecked();
  });
});

test.describe("maintenance and inspections (Plan 36)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");
  const C1 = "30000000-0000-4000-8000-000000000001";
  const REQUEST = "c0000000-0000-4000-8000-000000000001";
  const MOVE_OUT = "d0000000-0000-4000-8000-000000000002";
  const SCREENS = [
    { path: "/maintenance", heading: "Mantenimiento" },
    { path: `/maintenance/${REQUEST}`, heading: "Gotera debajo del fregadero" },
    { path: `/contracts/${C1}/inspections/${MOVE_OUT}`, heading: "Inspección de salida" },
    { path: `/contracts/${C1}/inspections/d0000000-0000-4000-8000-000000000001`, heading: "Inspección de entrada" },
  ];

  for (const scheme of ["light", "dark"] as const) {
    for (const { path, heading } of SCREENS) {
      test(`${path} (${scheme}) renders and has no serious a11y violations`, async ({ page, context, baseURL }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
        await page.screenshot({ path: `test-results/p36-${test.info().project.name}-${path.replace(/[^a-z0-9]+/gi, "_").slice(-40)}-${scheme}.png`, fullPage: true });
      });
    }
  }

  test("lists requests with facets and opens the new-request form", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/maintenance");
    await expect(page.getByText("Gotera debajo del fregadero").filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Nueva solicitud" }).click();
    const sheet = page.getByRole("dialog", { name: "Nueva solicitud de mantenimiento" });
    await expect(sheet.getByLabel("¿Qué pasa?")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Tomar foto" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Crear solicitud" })).toBeDisabled();
  });

  test("move-out editor compares with move-in and records a condition", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto(`/contracts/${C1}/inspections/${MOVE_OUT}`);
    await expect(page.getByRole("heading", { level: 2, name: "Sala" })).toBeVisible();
    await expect(page.getByText("Entrada: Buena · peor que a la entrada")).toBeVisible();
    const doors = page.getByRole("radiogroup", { name: "Puertas" });
    await doors.getByText("Regular").click();
    await expect(doors.getByRole("radio", { name: "Regular" })).toBeChecked();
    await page.getByRole("button", { name: "Siguiente habitación" }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "Cocina" })).toBeVisible();
  });

  test("contract page lists inspections", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto(`/contracts/${C1}`);
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Inspecciones" }) });
    await expect(section.getByText("Inspección de entrada")).toBeVisible();
    await expect(section.getByText(/El inquilino la confirmó/)).toBeVisible();
  });
});
