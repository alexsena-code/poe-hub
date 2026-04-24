import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Prices page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/farm/prices");
    await page.waitForLoadState("networkidle");
  });

  test("should render the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Historico de Precos" })
    ).toBeVisible();
  });

  test("should render the stats cards section", async ({ page }) => {
    // PriceStatsCards renders inside the first div.space-y-3 section.
    // We assert the section is present — cards may be empty when DB has no data.
    const statsSection = page.locator("div.space-y-3").first();
    await expect(statsSection).toBeVisible();
  });

  test("should render the PoE version filter select", async ({ page }) => {
    // The version filter defaults to "PoE 1"
    const versionSelect = page.getByRole("combobox").first();
    await expect(versionSelect).toBeVisible();
    await expect(versionSelect).toContainText("PoE 1");
  });

  test("should change poe version to PoE 2 and keep page stable", async ({
    page,
  }) => {
    const versionSelect = page.getByRole("combobox").first();
    await versionSelect.click();

    const poe2Option = page.getByRole("option", { name: "PoE 2" });
    await expect(poe2Option).toBeVisible();
    await poe2Option.click();

    // After selection the trigger should reflect PoE 2
    await expect(versionSelect).toContainText("PoE 2");

    // Page should not crash
    await expect(
      page.getByText("Application error", { exact: false })
    ).not.toBeVisible();
  });

  test("should render the stats item filter (Divine / Chaos / Mirror)", async ({
    page,
  }) => {
    // Second combobox is the statsItem select
    const itemSelect = page.getByRole("combobox").nth(1);
    await expect(itemSelect).toBeVisible();
    await expect(itemSelect).toContainText("Divine");
  });

  test("should switch stats item to Chaos and keep page stable", async ({
    page,
  }) => {
    const itemSelect = page.getByRole("combobox").nth(1);
    await itemSelect.click();

    const chaosOption = page.getByRole("option", { name: "Chaos" });
    await expect(chaosOption).toBeVisible();
    await chaosOption.click();

    await expect(itemSelect).toContainText("Chaos");
    await expect(
      page.getByText("Application error", { exact: false })
    ).not.toBeVisible();
  });

  test("should render the detailed history table heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Historico Detalhado" })
    ).toBeVisible();
  });

  test("should render the history table element", async ({ page }) => {
    // Even if there is no data, the table wrapper must be present
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test("should render the Configurar Sources link", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /Configurar Sources/ })
    ).toBeVisible();
  });
});
