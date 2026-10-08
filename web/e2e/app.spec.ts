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

test.describe("market data (Plan 40)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");
  const LISTING = "/market/4100009";
  const ANALYZE = "/watchlist/90000000-0000-4000-8000-000000000001/analyze";

  async function axeSerious(page: import("@playwright/test").Page) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .exclude(".leaflet-container")
      .analyze();
    return results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  }

  for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme });

      test("market overview: freshness, yields and rent comps", async ({ page, context, baseURL }, info) => {
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto("/market");
        await expect(page.getByRole("heading", { level: 1, name: /Mercado/ })).toBeVisible();
        await expect(page.getByText("Datos actualizados hace 3 días").first()).toBeVisible();

        const yields = page.locator("section", { has: page.getByRole("heading", { name: "Rendimiento por pueblo" }) });
        await expect(yields.getByText("Bayamón")).toBeVisible(); // accent variants merged
        await expect(yields.getByText("6 anuncios")).toBeVisible();
        await expect(yields.getByText("Dorado")).toHaveCount(0); // fewer than 5 listings

        const comps = page.locator("section", { has: page.getByRole("heading", { name: "Tu renta vs. la renta del mercado" }) });
        await expect(comps.getByText("Mediana $1,500 · 9 comparables")).toBeVisible();
        await expect(comps.getByText("23.3% bajo el mercado")).toBeVisible();

        await expect(page.locator('img[src*="zillowstatic"]')).toHaveCount(0);
        expect(await axeSerious(page)).toEqual([]);
        await comps.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`market-${scheme}.png`), fullPage: true });
      });

      test("listing detail: no hotlinked photo, rent estimate and listing link", async ({ page, context, baseURL }, info) => {
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto(LISTING);
        await expect(page.getByRole("heading", { level: 1, name: /Calle Demo 9/ })).toBeVisible();
        await expect(page.getByText("Las fotos están en el anuncio original.")).toBeVisible();
        await expect(page.locator("img")).toHaveCount(0);
        await expect(page.getByText("Renta estimada (Zillow)")).toBeVisible();
        await expect(page.getByRole("link", { name: "Ver anuncio original" })).toHaveAttribute("href", /zillow\.com\/homedetails/);
        await expect(page.getByText("Datos actualizados hace 3 días")).toBeVisible();
        expect(await axeSerious(page)).toEqual([]);
        await page.screenshot({ path: info.outputPath(`market-detail-${scheme}.png`), fullPage: true });
      });

      test("watchlist and analyzer: placeholder image and CRIM estimate", async ({ page, context, baseURL }, info) => {
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto("/watchlist");
        await expect(page.getByRole("heading", { level: 1, name: /Mi lista/ })).toBeVisible();
        await expect(page.locator('img[src*="zillowstatic"], img[srcset*="zillowstatic"]')).toHaveCount(0);
        expect(await axeSerious(page)).toEqual([]);
        await page.screenshot({ path: info.outputPath(`watchlist-${scheme}.png`), fullPage: true });

        await page.goto(ANALYZE);
        // "Bayamon" on the listing matches the "Bayamón" CRIM row; 9.58% × 45% ≈ 4.311%.
        await expect(page.getByText(/Estimado CRIM Bayamón \(2026-2027\): 9\.58%/)).toBeVisible();
        expect(await axeSerious(page)).toEqual([]);
        await page.screenshot({ path: info.outputPath(`analyze-${scheme}.png`), fullPage: true });
      });
    });
  }
});

// ── Plan 33: ATH Móvil ──────────────────────────────────────────────────────
test.describe("ATH Móvil", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");
  test.describe.configure({ mode: "serial" }); // the portal tests swap a fixture table

  const axe = async (page: import("@playwright/test").Page) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  };
  const setTable = (request: import("@playwright/test").APIRequestContext, table: string, rows: unknown[]) =>
    request.post(`${MOCK_URL}/__mock/set`, { data: { table, rows } });

  for (const scheme of ["light", "dark"] as const) {
    test(`landlord card on Cobros (${scheme})`, async ({ page, context, baseURL }, info) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signInMock(context, baseURL!, MOCK_URL!);
      await page.goto("/rent");
      const card = page.locator("section", { has: page.getByRole("heading", { name: "ATH Móvil Business" }) });
      await expect(card.getByText("Conectado", { exact: true })).toBeVisible();
      await expect(card.getByText(/Rivera Propiedades/)).toBeVisible();
      await card.getByRole("button", { name: "Actualizar tokens" }).click();
      await expect(card.getByText(/Configuración → Integración con API/)).toBeVisible();
      await expect(card.getByText(/no tiene ambiente de prueba/)).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.screenshot({ path: info.outputPath(`ath-card-${scheme}.png`), fullPage: true });
    });
  }

  test("saving tokens is refused without a server encryption key", async ({ page, context, baseURL }) => {
    test.skip(!!process.env.FIELD_ENCRYPTION_KEY, "server has an encryption key");
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/rent");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "ATH Móvil Business" }) });
    await card.getByRole("button", { name: "Actualizar tokens" }).click();
    await card.getByLabel("Token público").fill("pk_demo_1234567890");
    await card.getByRole("button", { name: "Guardar tokens" }).click();
    await expect(page.getByText(/falta la clave de cifrado/)).toBeVisible();
  });

  test("the ledger marks payments made with ATH Móvil", async ({ page, context, baseURL }) => {
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/contracts/30000000-0000-4000-8000-000000000001");
    await expect(page.getByText("Pagado con ATH Móvil")).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`tenant portal offers ATH Móvil when connected (${scheme})`, async ({ page, context, baseURL }, info) => {
      // The hide test below swaps a shared fixture table; keep portal checks in one project.
      test.skip(info.project.name !== "desktop", "portal ATH checks run on desktop only");
      await page.emulateMedia({ colorScheme: scheme });
      await signInMock(context, baseURL!, MOCK_URL!, { role: "tenant" });
      await page.goto("/portal");
      await expect(page.getByRole("heading", { level: 1, name: "Mis contratos" })).toBeVisible();
      await page.getByRole("button", { name: "Pagar con ATH Móvil" }).click();
      await expect(page.getByLabel("Cantidad")).not.toHaveValue("");
      await expect(page.getByLabel("Tu teléfono de ATH Móvil")).toHaveValue("7875550101");
      await expect(page.getByText(/va directo a Rivera Propiedades/)).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.screenshot({ path: info.outputPath(`portal-ath-${scheme}.png`), fullPage: true });
    });
  }

  test("tenant portal hides ATH Móvil when the landlord is not connected", async ({ page, context, baseURL, request }, info) => {
    test.skip(info.project.name !== "desktop", "portal ATH checks run on desktop only");
    const res = await request.get(`${MOCK_URL}/rest/v1/ath_movil_accounts`);
    const saved = await res.json();
    await setTable(request, "ath_movil_accounts", []);
    try {
      await signInMock(context, baseURL!, MOCK_URL!, { role: "tenant" });
      await page.goto("/portal");
      await expect(page.getByRole("heading", { level: 1, name: "Mis contratos" })).toBeVisible();
      await expect(page.getByText("Pagos recientes")).toBeVisible();
      await expect(page.getByRole("button", { name: "Pagar con ATH Móvil" })).toHaveCount(0);
    } finally {
      await setTable(request, "ath_movil_accounts", saved);
    }
  });
});

test.describe("AI assistance (Plan 39)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");
  // E2E_AI=1 when the app runs with ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL
  // pointing at e2e/mock/anthropic.mjs; otherwise the AI UI must not exist.
  const AI = process.env.E2E_AI === "1";
  const C1 = "30000000-0000-4000-8000-000000000001";

  test("AI panels are hidden without ANTHROPIC_API_KEY", async ({ page, context, baseURL }) => {
    test.skip(AI, "app started with an AI key");
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pregúntale a tus datos" })).toHaveCount(0);
    await page.goto(`/contracts/${C1}`);
    await expect(page.getByRole("heading", { name: "Renta y pagos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Redactar aviso" })).toHaveCount(0);
    await page.goto("/settings/sections");
    await expect(page.getByText("Mascotas", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Traducir al inglés/ })).toHaveCount(0);
  });

  test.describe("with a (mock) key", () => {
    test.skip(!AI, "E2E_AI not set");

    for (const scheme of ["light", "dark"] as const) {
      test(`dashboard Q&A answers from tools (${scheme})`, async ({ page, context, baseURL }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto("/dashboard");
        const panel = page.locator("section", { has: page.getByRole("heading", { name: "Pregúntale a tus datos" }) });
        await panel.getByRole("button", { name: "¿Quién está atrasado?" }).click();
        await expect(panel.getByText(/José Martínez .* debe \$1,200/)).toBeVisible();
        await expect(panel.getByText("Atrasos")).toBeVisible();
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).include("#ask-data-title").analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => v.id)).toEqual([]);
        await panel.screenshot({ path: `test-results/p39-${test.info().project.name}-ask-${scheme}.png` });
      });

      test(`notice draft sheet (${scheme})`, async ({ page, context, baseURL }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto(`/contracts/${C1}`);
        await page.getByRole("button", { name: "Redactar aviso" }).click();
        const sheet = page.getByRole("dialog", { name: "Redactar aviso" });
        await expect(sheet.getByText(/Balance atrasado según la cuenta de renta: \$1,200/)).toBeVisible();
        await sheet.getByRole("button", { name: "Generar borrador" }).click();
        await expect(sheet.getByText("Borrador generado con IA — revísalo antes de enviarlo")).toBeVisible();
        await expect(sheet.getByLabel("Asunto")).toHaveValue("Balance pendiente de renta");
        await expect(sheet.getByLabel("Mensaje")).toHaveValue(/balance vencido de \$1,200/);
        await expect(sheet.getByRole("button", { name: /Enviar/ })).toHaveCount(0);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).include('[role="dialog"]').analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => v.id)).toEqual([]);
        await page.screenshot({ path: `test-results/p39-${test.info().project.name}-notice-${scheme}.png` });
      });

      test(`clause translation draft (${scheme})`, async ({ page, context, baseURL }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await signInMock(context, baseURL!, MOCK_URL!);
        await page.goto("/settings/sections");
        await page.getByRole("button", { name: "Traducir al inglés la cláusula Mascotas" }).click();
        await expect(page.getByText("Glosario pendiente de revisión legal")).toBeVisible();
        await expect(page.getByLabel("Título traducido")).toHaveValue("Pets");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => v.id)).toEqual([]);
        await page.screenshot({ path: `test-results/p39-${test.info().project.name}-translate-${scheme}.png`, fullPage: true });
        await page.getByRole("button", { name: "Usar traducción" }).click();
        // Accepting only fills the edit form; saving stays a manual step.
        await expect(page.locator("#edit-title-e3900000-0000-4000-8000-000000000001")).toHaveValue("Pets");
      });
    }
  });
});

test.describe("referrals (Plan 37)", () => {
  test.skip(!MOCK_URL, "MOCK_SUPABASE_URL not set");

  for (const scheme of ["light", "dark"] as const) {
    test(`billing shows the referral card accessibly (${scheme})`, async ({ page, context, baseURL }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await signInMock(context, baseURL!, MOCK_URL!);
      await page.goto("/settings/billing");
      const card = page.getByRole("region", { name: "Invita a otro propietario" });
      await expect(card).toBeVisible();
      await expect(card.getByLabel("Tu enlace de referido")).toHaveValue(/\/r\/MRV7K3QH$/);
      const stats = card.getByRole("definition");
      await expect(stats.nth(0)).toHaveText("2");
      await expect(stats.nth(1)).toHaveText("1");
      const wa = card.getByRole("link", { name: "Compartir por WhatsApp" });
      await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=.*r%2FMRV7K3QH/);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/referral-card-${scheme}-${test.info().project.name}.png`, fullPage: false });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }

  test("copy button copies the link", async ({ page, context, baseURL, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInMock(context, baseURL!, MOCK_URL!);
    await page.goto("/settings/billing");
    await page.getByRole("button", { name: "Copiar" }).click();
    await expect(page.getByText("Enlace copiado")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/r\/MRV7K3QH$/);
  });
});
