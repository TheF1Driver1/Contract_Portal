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
