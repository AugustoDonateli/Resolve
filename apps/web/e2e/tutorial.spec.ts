import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Tutorial (sessão 3 do plano v2) com a conta de teste B: recomeça pelo próprio app ("Rever o tutorial")
 * e percorre a ficha de identificação, a primeira questão com o Raio-X apresentado, o tour da mesa e as
 * dicas da primeira vez. Cada rodada responde uma questão real na conta B.
 */
const student = { email: process.env.E2E_EMAIL_B ?? "", password: process.env.E2E_PASSWORD_B ?? "" };
test.skip(!student.email, "credenciais de teste ausentes");
test.describe.configure({ mode: "serial" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length}`);
}

async function signIn(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(student.email);
  await page.getByLabel("Senha", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
}

test("tutorial: ficha, primeira questão com Raio-X, tour da mesa e dicas da primeira vez", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  // Rever o tutorial: os primeiros passos voltam para a mesa.
  await page.goto("/mais/como-funciona");
  for (const name of ["Triagem de 20 segundos", "Blocos de ritmo", "Dia D", "Duelo"]) await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.getByRole("button", { name: "Recomeçar o tutorial" }).click();
  await page.waitForURL("**/hoje");
  const steps = page.locator("section[aria-labelledby=primeiros-passos]");
  await expect(steps.getByRole("heading", { name: "Ficha de identificação" })).toBeVisible();
  // A mesa continua inteira atrás dos primeiros passos: nada de tela de boas-vindas no caminho.
  await expect(page.getByRole("navigation", { name: "Objetos da mesa" })).toBeVisible();
  await expect(page.locator("#plano-hoje")).toBeVisible();
  await page.waitForTimeout(800);
  expect(await violations(page)).toEqual([]);

  // 1. Ficha: a data já vem preenchida; curso em branco é aceito.
  await expect(steps.getByLabel("1º dia de prova")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await steps.getByText("15 h", { exact: true }).click();
  await steps.getByText("Inglês", { exact: true }).click();
  await steps.getByRole("button", { name: "Guardar ficha" }).click();
  await expect(steps.getByRole("heading", { name: "Primeira questão" })).toBeVisible();

  // 2. Primeira questão: responder e ver o Raio-X sem pedir.
  await steps.getByRole("button", { name: "Responder a primeira questão" }).click();
  await page.waitForURL(/\/estudar\/sessao\/.+primeira=1/);
  await expect(page.getByRole("heading", { name: "Primeira questão", level: 1 })).toBeVisible();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("heading", { name: "Raio-X", level: 3 })).toBeVisible();
  await expect(page.getByText("Este é o Raio-X.", { exact: false })).toBeVisible();

  // 3. Tour: começa por pedido, não anda sozinho, avança por botão ou seta e termina em Hoje.
  await page.getByRole("link", { name: "Conhecer a mesa" }).click();
  await page.waitForURL("**/hoje?tour=1");
  const tour = page.getByRole("dialog");
  await expect(tour).toContainText(/1 de 6/i);
  await expect(tour.getByRole("heading", { name: "Folha de hoje" })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(tour).toContainText(/1 de 6/i);
  expect(await violations(page)).toEqual([]);
  await tour.getByRole("button", { name: "Próximo" }).click();
  await expect(tour.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: "Caderno" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: "Fichas" })).toBeVisible();
  await expect(tour).toContainText("3, 7, 14 e 30 dias");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: "Régua" })).toBeVisible();
  await tour.getByRole("button", { name: "Terminar" }).click();
  await expect(tour).toHaveCount(0);
  await expect(steps).toHaveCount(0);
  await expect(page).toHaveURL(/\/hoje$/);
  await page.reload();
  await expect(page.locator("#plano-hoje")).toBeVisible();
  await expect(steps).toHaveCount(0);

  // O tour pode ser revisto e fechado a qualquer momento (Esc), também no celular.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hoje?tour=1");
  await expect(tour).toContainText(/1 de 6/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });

  // 4. Dicas da primeira vez: aparecem uma vez, no lugar em que o recurso começa.
  await page.goto("/estudar");
  const tips = page.locator("aside[aria-labelledby^=dica-]");
  await expect(tips).toHaveCount(2);
  await tips.first().scrollIntoViewIfNeeded();
  await expect(tips.first()).toContainText("Quanto tempo");
  expect(await violations(page)).toEqual([]);
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Estudar", level: 1 })).toBeVisible();
  await expect(tips).toHaveCount(0);

  // A ficha fica editável em Mais, com o que foi respondido.
  await page.goto("/mais/ficha");
  await expect(page.getByRole("radio", { name: "15 h" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Inglês" })).toBeChecked();
  expect(await violations(page)).toEqual([]);
});
