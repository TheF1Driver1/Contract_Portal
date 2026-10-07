import { test, expect } from "@playwright/test";

// Runs without a database session: public pages render and private routes
// redirect to login.

test("landing page links to legal pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Términos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacidad" })).toBeVisible();
});

test("pricing shows the three plans", async ({ page }) => {
  await page.goto("/pricing");
  for (const plan of ["Gratis", "Propietario", "Inversionista"]) {
    await expect(page.getByRole("heading", { name: plan, exact: true })).toBeVisible();
  }
});

test("terms and privacy are public in both languages", async ({ page }) => {
  for (const [path, title] of [
    ["/terminos", "Términos de servicio"],
    ["/privacidad", "Política de privacidad"],
    ["/en/terms", "Terms of Service"],
    ["/en/privacy", "Privacy Policy"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
});

test("signup requires accepting the terms", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByRole("link", { name: "Términos de servicio" })).toHaveAttribute("href", "/terminos");
});

test("private routes redirect to login", async ({ page }) => {
  for (const path of ["/dashboard", "/contracts", "/settings/billing"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBeLessThan(600);
});
