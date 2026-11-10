import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Estudar (F3-T02) com a conta de teste A. Sem questões publicadas, confere o estado vazio honesto.
 * Com questões publicadas, roda o fluxo real: começar treino, responder, recarregar e ver a resposta
 * preservada, e o gabarito só depois da confirmação.
 */
const student = {
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? "",
};
test.skip(!student.email, "credenciais de teste ausentes");

async function signIn(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(student.email);
  await page.getByLabel("Senha", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
}

test("estudar: estado vazio ou treino real com resposta preservada ao recarregar", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/estudar");
  const empty = page.getByText("Ainda não há questões publicadas", { exact: true });
  const form = page.getByRole("form", { name: "Começar treino" });
  await expect(empty.or(form)).toBeVisible();

  if (await empty.isVisible()) {
    await page.getByRole("link", { name: "Ver questão demonstrativa" }).click();
    await expect(page).toHaveURL(/\/estudar\/demonstracao/);
    await expect(
      page.getByText("Questão demonstrativa · não é item do ENEM"),
    ).toBeVisible();
    test
      .info()
      .annotations.push({
        type: "pendente",
        description: "fluxo real aguarda questões publicadas (F2-T16)",
      });
    return;
  }

  await form.getByRole("combobox", { name: "Quantidade" }).selectOption("5");
  await form.getByRole("button", { name: "Começar treino" }).click();
  await page.waitForURL(/\/estudar\/sessao\//);
  const url = page.url();
  await expect(
    page.getByRole("heading", { name: /Questão 1 de \d+/ }),
  ).toBeVisible();
  await expect(page.getByText("Correta", { exact: true })).toHaveCount(0); // nada de gabarito antes
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Você acertou|Resposta correta/ }),
  ).toBeVisible({ timeout: 15_000 });
  const verdict = await page
    .getByRole("status")
    .filter({ hasText: /Você acertou|Resposta correta/ })
    .innerText();

  // recarregar: a primeira questão já respondida não volta em branco
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: /Questão 2 de \d+|Treino concluído/ }),
  ).toBeVisible();
  const prev = page.getByRole("button", { name: "Anterior" });
  if (await prev.isVisible()) await prev.click();
  else await page.getByRole("button", { name: "Rever as respostas" }).click();
  await expect(
    page.getByRole("heading", { name: /Questão 1 de/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Você acertou|Resposta correta/ }),
  ).toHaveText(verdict);
  await expect(page.getByRole("radio").first()).toBeChecked();
});

test("estudar: sessão de outra conta ou inexistente não abre", async ({
  page,
}) => {
  await signIn(page);
  const res = await page.goto(
    "/estudar/sessao/00000000-0000-4000-8000-000000000000",
  );
  expect(res?.status()).toBe(404);
});
