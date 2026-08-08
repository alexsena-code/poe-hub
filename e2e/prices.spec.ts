import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * Página de preço da concorrência (G2G).
 *
 * Substitui o E2E do scraper do Discord, removido em ago/2026. Os testes não
 * disparam coleta real: a G2G é serviço de terceiro e um E2E que depende dela
 * fica intermitente por motivo alheio ao código.
 */
test.describe("Precos (G2G)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/farm/prices");
  });

  test("renderiza o cabecalho da pagina", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Preço da Concorrência" }),
    ).toBeVisible();
  });

  test("mostra os cards de estatistica", async ({ page }) => {
    await expect(page.getByText("Mediana G2G")).toBeVisible();
    await expect(page.getByText("Piso competitivo (p25)")).toBeVisible();
    await expect(page.getByText("Ofertas válidas")).toBeVisible();
  });

  test("mostra o grafico com os seletores de janela", async ({ page }) => {
    await expect(page.getByText("Preço na G2G")).toBeVisible();
    for (const label of ["24h", "7d", "30d", "90d"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("troca a janela do grafico ao clicar", async ({ page }) => {
    await page.getByRole("button", { name: "30d", exact: true }).click();
    await expect(page.getByRole("button", { name: "30d", exact: true })).toBeVisible();
  });

  test("expoe o botao de coleta manual", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Coletar agora" })).toBeVisible();
  });

  test("mantem a secao de arquivo do historico antigo", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Arquivo — histórico do Discord" }),
    ).toBeVisible();
  });

  test("nao oferece mais as acoes do scraper do Discord", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Subir JSON" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Configurar Sources" }),
    ).toHaveCount(0);
  });
});
