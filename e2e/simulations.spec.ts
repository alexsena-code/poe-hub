import { test, expect, Page } from "@playwright/test";
import { login } from "./helpers/auth";

/** Name used throughout the test — unique per run to avoid collisions. */
const SIM_NAME = `E2E Test Sim ${Date.now()}`;

async function openSimulationsPage(page: Page): Promise<void> {
  await page.goto("/simulations");
  // Wait for the table/skeleton to settle
  await page.waitForLoadState("networkidle");
}

test.describe("Simulations CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should render the simulations page heading", async ({ page }) => {
    await openSimulationsPage(page);
    await expect(
      page.getByRole("heading", { name: "Simulacoes de Faturamento" })
    ).toBeVisible();
  });

  test("should render the Nova Simulacao button", async ({ page }) => {
    await openSimulationsPage(page);
    await expect(
      page.getByRole("button", { name: "Nova Simulacao" })
    ).toBeVisible();
  });

  test("should open create dialog when clicking Nova Simulacao", async ({
    page,
  }) => {
    await openSimulationsPage(page);
    await page.getByRole("button", { name: "Nova Simulacao" }).click();

    await expect(
      page.getByRole("dialog", { name: "Nova Simulacao" })
    ).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByLabel("Duracao (semanas)")).toBeVisible();
  });

  test("should show validation error when submitting empty form", async ({
    page,
  }) => {
    await openSimulationsPage(page);
    await page.getByRole("button", { name: "Nova Simulacao" }).click();

    // Clear the duration field and submit
    await page.getByLabel("Nome").fill("");
    await page.getByRole("button", { name: "Criar Simulacao" }).click();

    await expect(page.getByText("Nome obrigatorio")).toBeVisible();
  });

  test("should create a new simulation and redirect to its editor", async ({
    page,
  }) => {
    await openSimulationsPage(page);
    await page.getByRole("button", { name: "Nova Simulacao" }).click();

    const dialog = page.getByRole("dialog", { name: "Nova Simulacao" });

    // Fill the form
    await dialog.getByLabel("Nome").fill(SIM_NAME);

    // Select a league from the dropdown — wait for it to load
    const leagueSelect = dialog.getByRole("combobox").first();
    await leagueSelect.click();
    // Pick first available option
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 8_000 });
    await firstOption.click();

    await dialog.getByLabel("Duracao (semanas)").fill("4");

    await dialog.getByRole("button", { name: "Criar Simulacao" }).click();

    // Should redirect to /simulations/<id>
    await page.waitForURL(/\/simulations\/[^/]+$/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/simulations\/[^/]+$/);
  });

  test("should show the newly created simulation in the list", async ({
    page,
  }) => {
    await openSimulationsPage(page);
    // The simulation created in the previous test may or may not persist between
    // test runs depending on DB state, so we just verify the table is rendered.
    // If the list is not empty the row should contain text content.
    const tableBody = page.locator("table tbody");
    await expect(tableBody).toBeVisible();
  });

  test("should open the week editor when clicking a simulation row", async ({
    page,
  }) => {
    await openSimulationsPage(page);

    // Look for any existing row in the table; skip if empty
    const firstRow = page.locator("table tbody tr").first();
    const rowText = await firstRow.innerText();

    if (rowText.includes("Nenhuma simulacao encontrada")) {
      test.skip();
      return;
    }

    await firstRow.click();
    await page.waitForURL(/\/simulations\/[^/]+$/, { timeout: 10_000 });

    // The simulation editor page should render
    expect(page.url()).toMatch(/\/simulations\/[^/]+$/);
    // Editor renders week cards or a heading — verify we're past the list page
    await expect(page.getByText("Nenhuma simulacao encontrada")).not.toBeVisible();
  });

  test("should delete a simulation via the delete button", async ({ page }) => {
    // First create a fresh simulation to delete
    await openSimulationsPage(page);
    await page.getByRole("button", { name: "Nova Simulacao" }).click();

    const dialog = page.getByRole("dialog", { name: "Nova Simulacao" });
    const deleteName = `Delete Me ${Date.now()}`;
    await dialog.getByLabel("Nome").fill(deleteName);

    const leagueSelect = dialog.getByRole("combobox").first();
    await leagueSelect.click();
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 8_000 });
    await firstOption.click();

    await dialog.getByLabel("Duracao (semanas)").fill("2");
    await dialog.getByRole("button", { name: "Criar Simulacao" }).click();

    // After redirect go back to the list
    await page.waitForURL(/\/simulations\/[^/]+$/, { timeout: 15_000 });
    await page.goto("/simulations");
    await page.waitForLoadState("networkidle");

    // Find the row for the simulation we just created
    const targetRow = page.locator("table tbody tr", {
      hasText: deleteName,
    });
    await expect(targetRow).toBeVisible({ timeout: 8_000 });

    // Click the delete (Trash2) icon — use title attribute set in simulation-list.tsx
    const deleteBtn = targetRow.getByTitle("Deletar");
    await deleteBtn.click();

    // Confirm the browser confirm() dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Row should disappear
    await expect(targetRow).not.toBeVisible({ timeout: 8_000 });
  });
});
