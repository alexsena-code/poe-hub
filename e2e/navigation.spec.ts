import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * Maps each sidebar nav label to the URL segment it should load.
 * Labels come from sidebar.tsx navItems array.
 */
const NAV_ITEMS = [
  { label: "Dashboard", urlSegment: "/dashboard" },
  { label: "Bots", urlSegment: "/bots" },
  { label: "Tarefas", urlSegment: "/tasks" },
  { label: "Vendas", urlSegment: "/sales" },
  { label: "Precos", urlSegment: "/prices" },
  { label: "Simulacoes", urlSegment: "/simulations" },
  { label: "Configuracoes", urlSegment: "/settings" },
];

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { label, urlSegment } of NAV_ITEMS) {
    test(`should navigate to ${urlSegment} when clicking "${label}"`, async ({
      page,
    }) => {
      const sidebar = page.locator("aside");

      await sidebar.getByRole("link", { name: label }).click();
      await page.waitForURL(`**${urlSegment}**`, { timeout: 10_000 });

      expect(page.url()).toContain(urlSegment);

      // The page must not have crashed — no unhandled error overlay should be visible.
      // Next.js error overlay contains "Application error" text.
      await expect(
        page.getByText("Application error", { exact: false })
      ).not.toBeVisible();
    });
  }

  test("should highlight the active sidebar link on navigation", async ({
    page,
  }) => {
    const sidebar = page.locator("aside");

    await sidebar.getByRole("link", { name: "Simulacoes" }).click();
    await page.waitForURL("**/simulations", { timeout: 10_000 });

    // The active link has the bg-sidebar-accent class — verify via aria-current or class
    const activeLink = sidebar.getByRole("link", { name: "Simulacoes" });
    // Active links have a distinct background set in sidebar.tsx
    await expect(activeLink).toHaveClass(/bg-sidebar-accent/);
  });

  test("should render the sidebar brand link on every page", async ({
    page,
  }) => {
    for (const { urlSegment } of NAV_ITEMS) {
      await page.goto(urlSegment);
      const sidebar = page.locator("aside");
      await expect(sidebar.getByText("PoE HUB")).toBeVisible();
    }
  });
});
