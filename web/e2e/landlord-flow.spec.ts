import { test, expect } from "@playwright/test";

// Full landlord journey against a seeded test project (Supabase branch or
// local stack). Skipped unless E2E_EMAIL and E2E_PASSWORD are set.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("landlord flow", () => {
  test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD not set");

  test("log in, add a property and a tenant, start a contract", async ({ page }) => {
    const stamp = Date.now();
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in|iniciar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/properties");
    await page.getByRole("button", { name: /add property|añadir propiedad/i }).click();
    await page.getByLabel(/name|nombre/i).first().fill(`E2E Casa ${stamp}`);
    await page.getByLabel(/address|dirección/i).first().fill("Calle Luna 100");
    await page.getByLabel(/city|ciudad/i).first().fill("San Juan");
    await page.getByRole("button", { name: /save|guardar/i }).click();
    await expect(page.getByText(`E2E Casa ${stamp}`)).toBeVisible();

    await page.goto("/tenants");
    await page.getByRole("button", { name: /add tenant|añadir inquilino/i }).click();
    await page.getByLabel(/full name|nombre completo/i).fill(`E2E Inquilino ${stamp}`);
    await page.getByRole("button", { name: /save|guardar/i }).click();
    await expect(page.getByText(`E2E Inquilino ${stamp}`)).toBeVisible();

    await page.goto("/contracts/new");
    await expect(page.getByText(`E2E Casa ${stamp}`).first()).toBeAttached();
  });
});
