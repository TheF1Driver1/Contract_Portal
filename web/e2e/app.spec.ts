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
