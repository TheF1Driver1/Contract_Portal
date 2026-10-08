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

test.describe("messaging", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");

  test("contract shows the message timeline with delivery status", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/contracts/30000000-0000-4000-8000-000000000001");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Mensajes" }) });
    await expect(section.getByText("Aviso de renta vencida")).toBeVisible();
    await expect(section.getByText("Leído")).toBeVisible();
    await expect(section.getByText("Buenas, ya envié el pago por ATH Móvil.")).toBeVisible();
    await expect(section.getByText("Motivo: sin consentimiento para este medio")).toBeVisible();
  });

  test("tenant form records WhatsApp/SMS consent and respects STOP", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/tenants");
    await page.getByRole("button", { name: "Editar José Martínez" }).first().click();
    const sheet = page.getByRole("dialog");
    const wa = sheet.getByRole("checkbox", { name: "El inquilino aceptó recibir mensajes por WhatsApp" });
    await expect(wa).toBeChecked();
    await expect(sheet.getByRole("checkbox", { name: "El inquilino aceptó recibir mensajes de texto (SMS)" })).toBeDisabled();
    await expect(sheet.getByText(/Respondió STOP/)).toBeVisible();
    await wa.click();
    await expect(wa).not.toBeChecked();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`reminder settings with the digest toggle are accessible (${scheme})`, async ({ page, context, baseURL }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signInMock(context, baseURL!, MOCK_URL!);
      await page.goto("/settings/notifications");
      await expect(page.getByRole("switch", { name: "Resumen diario por correo" })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }
});
