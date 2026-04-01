import { Page } from "@playwright/test";

/**
 * Performs a full login flow through the UI and waits for the redirect to /dashboard.
 * Re-use this in every spec that requires an authenticated session.
 */
export async function login(
  page: Page,
  username = "admin",
  password = "admin123"
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Wait for the authenticated layout (sidebar) to confirm redirect
  await page.waitForURL("/dashboard", { timeout: 15_000 });
}
