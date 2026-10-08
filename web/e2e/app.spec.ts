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

test.describe("tax pack (Plan 35)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");

  const TAX_PAGES = [
    { path: "/reports", heading: "Reportes" },
    { path: "/reports/annual", heading: "Paquete anual" },
    { path: "/reports/crim", heading: "CRIM" },
    { path: "/properties?crim=10000000-0000-4000-8000-000000000001", heading: "CRIM · Edificio Las Palmas 2B" },
  ];

  for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme });
      for (const { path, heading } of TAX_PAGES) {
        test(`${path} renders and has no serious a11y violations`, async ({ page, context, baseURL }) => {
          await signInMock(context, baseURL!, MOCK_URL!);
          await page.goto(path);
          // The CRIM sheet is modal (full screen on phones), so check it instead of the page title.
          if (path.includes("crim=")) await expect(page.getByRole("dialog", { name: heading })).toBeVisible();
          else await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".leaflet-container").analyze();
          const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
          expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
        });
      }
    });
  }

  test("CRIM sheet shows the estimate and marks a bill paid", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/properties");
    await page.getByRole("button", { name: "CRIM y datos fiscales de Edificio Las Palmas 2B" }).click();
    const sheet = page.getByRole("dialog", { name: "CRIM · Edificio Las Palmas 2B" });
    // $42,000 assessed × 10.83% (San Juan).
    await expect(sheet.getByText("$4,548.60")).toBeVisible();
    await expect(sheet.getByText("Estimado", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Pendiente", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Marcar pagada" }).click();
    const pay = page.getByRole("dialog", { name: "Marcar factura como pagada" });
    await expect(pay.getByLabel("Registrar como gasto (Contribuciones)")).toBeChecked();
    await pay.getByRole("button", { name: "Marcar pagada" }).click();
    await expect(page.getByText("Factura marcada como pagada")).toBeVisible();
  });

  test("annual package follows the residency and switches to Schedule E", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/reports/annual");
    await expect(page.getByText("Pendiente de revisión por un CPA")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Anejo N (Hacienda)" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Schedule E (IRS)" }).click();
    await expect(page).toHaveURL(/view=schedule_e/);
    await expect(page.getByRole("link", { name: "Abrir Schedule E" })).toBeVisible();
  });

  test("an upcoming CRIM bill shows in Hoy", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/dashboard");
    const today = page.locator("section", { has: page.getByRole("heading", { name: "Hoy" }) });
    await expect(today.getByText("El CRIM vence en 12 días")).toBeVisible();
    await expect(today.getByRole("link", { name: /^Pagar: CRIM · Edificio Las Palmas 2B/ })).toHaveAttribute("href", "/properties?crim=10000000-0000-4000-8000-000000000001");
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
