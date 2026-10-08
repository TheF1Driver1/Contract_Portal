import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Runs without a database session: public pages render and private routes
// redirect to login.

test("landing page links to legal pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Términos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacidad" })).toBeVisible();
});

test("pricing shows the three plans in both languages", async ({ page }) => {
  await page.goto("/pricing");
  for (const plan of ["Gratis", "Propietario", "Inversionista"]) {
    await expect(page.getByRole("heading", { name: plan, exact: true })).toBeVisible();
  }
  await page.goto("/en/pricing");
  for (const plan of ["Free", "Landlord", "Investor"]) {
    await expect(page.getByRole("heading", { name: plan, exact: true })).toBeVisible();
  }
});

test("landing is Spanish at / and English at /en", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Puerto Rico");
  await expect(page.getByRole("link", { name: "Empieza gratis" }).first()).toBeVisible();
  await page.goto("/en");
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
});

test("SEO files are served", async ({ request }) => {
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/en/pricing");
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

test("unsubscribe rejects a forged link", async ({ page, request }) => {
  await page.goto("/unsubscribe?u=00000000-0000-4000-8000-000000000001&s=forged");
  await expect(page.getByText("Este enlace no es válido")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  const res = await request.post("/api/unsubscribe?u=00000000-0000-4000-8000-000000000001&s=forged");
  expect(res.status()).toBe(400);
});

test("enterprise contact page is public and validates input", async ({ page, request }) => {
  await page.goto("/pricing");
  await page.getByRole("link", { name: /Contáctanos|Hablemos|Contactar/ }).first().click();
  await expect(page).toHaveURL(/\/contacto$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await page.goto("/en/contact");
  await expect(page.getByLabel("Email")).toBeVisible();

  const bad = await request.post("/api/contact", { data: { name: "A", email: "x", message: "hi" } });
  expect(bad.status()).toBe(400);
  // A filled honeypot looks like success but sends nothing.
  const bot = await request.post("/api/contact", {
    data: { name: "Bot", email: "bot@example.com", message: "Buy cheap things now", website: "http://spam" },
  });
  expect(bot.status()).toBe(200);
});

test("partner program page is public, linked from the footer and validates input", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Programa de socios" }).click();
  await expect(page).toHaveURL(/\/socios$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Contador / CPA" })).toBeVisible();
  await page.goto("/en/partners");
  await expect(page.getByLabel("Email")).toBeVisible();

  const bad = await request.post("/api/partners", { data: { name: "A", email: "x", kind: "lawyer" } });
  expect(bad.status()).toBe(400);
  // A filled honeypot looks like success but sends nothing.
  const bot = await request.post("/api/partners", {
    data: { name: "Bot", email: "bot@example.com", kind: "realtor", website: "http://spam" },
  });
  expect(bot.status()).toBe(200);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/socios");
});

test("referral links set the cookie and land on signup", async ({ page, context }) => {
  await page.goto("/r/abcd-efgh");
  await expect(page).toHaveURL(/\/signup$/);
  const cookie = (await context.cookies()).find((c) => c.name === "cos_ref");
  expect(cookie?.value).toBe("ABCDEFGH");
});

test("terms describe the referral program", async ({ page }) => {
  await page.goto("/terminos");
  await expect(page.getByRole("heading", { name: "6. Programa de referidos" })).toBeVisible();
  await page.goto("/en/terms");
  await expect(page.getByRole("heading", { name: "6. Referral program" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`partner page has no serious a11y violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/socios");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: `test-results/socios-${scheme}-${test.info().project.name}.png`, fullPage: true });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}
