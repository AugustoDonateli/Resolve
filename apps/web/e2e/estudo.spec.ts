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
  const empty = page.getByText("Ainda não há questões publicadas", {
    exact: true,
  });
  const form = page.getByRole("form", { name: "Começar treino" });
  await expect(empty.or(form)).toBeVisible();

  if (await empty.isVisible()) {
    await page.getByRole("link", { name: "Ver questão demonstrativa" }).click();
    await expect(page).toHaveURL(/\/estudar\/demonstracao/);
    await expect(
      page.getByText("Questão demonstrativa · não é item do ENEM"),
    ).toBeVisible();
    test.info().annotations.push({
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

  // Raio-X só depois de responder (F3-T04)
  await page.getByRole("button", { name: "Ver Raio-X" }).click();
  await expect(
    page.getByRole("heading", { name: "Raio-X", level: 3 }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /^Resolução/ })).toBeVisible();

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

  // Queda de conexão (F3-T03): a resposta fica guardada e é enviada quando a rede volta, sem duplicar.
  const next = page.getByRole("button", { name: /Próxima questão/ });
  if (await next.isVisible()) {
    await next.click();
    await page.getByRole("radio").first().click();
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(
      page.getByText(/Sem conexão: sua resposta ficou guardada/),
    ).toBeVisible({ timeout: 20_000 });
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /Você acertou|Resposta correta/ }),
    ).toBeVisible({ timeout: 20_000 });
  }
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

test("revisar: fila do dia sem seleção manual e escolha de tempo", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/revisar");
  await expect(
    page.getByRole("navigation", { name: "Tempo disponível" }),
  ).toBeVisible();
  const empty = page.getByRole("heading", { name: "Nada para revisar hoje" });
  const batch = page.getByText(/cabem? em 30 min/);
  await expect(empty.or(batch)).toBeVisible();
  await page.getByRole("link", { name: "60 min" }).click();
  await expect(page).toHaveURL(/min=60/);
  await expect(page.getByRole("link", { name: "60 min" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("banco: filtros por URL e recuperação de combinação vazia", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/estudar/banco");
  await expect(
    page.getByRole("heading", { level: 1, name: "Banco de questões" }),
  ).toBeVisible();
  const none = page.getByText(
    "Ainda não há questões publicadas. O banco mostra só questões reais do Enem conferidas.",
  );
  if (await none.isVisible()) return; // sem publicadas: nada a filtrar (lógica coberta por bank.test.ts)
  await page.goto("/estudar/banco?area=LC&habilidade=H99");
  await expect(page.getByRole("heading", { name: /^\d+ quest/ })).toBeVisible();
  await page.goto("/estudar/banco?habilidade=H30&area=MT&dia=d1");
  const empty = page.getByText(
    "Nenhuma questão publicada com essa combinação.",
  );
  if (await empty.isVisible()) {
    await page.getByRole("link", { name: "Limpar todos os filtros" }).click();
    await expect(page).toHaveURL(/\/estudar\/banco$/);
  }
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("triagem: três decisões, página oculta não conta tempo, janela encerra sem avançar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page);
  await page.goto("/estudar");
  const form = page.getByRole("form", { name: "Começar triagem" });
  if (!(await form.isVisible())) {
    test
      .info()
      .annotations.push({
        type: "pendente",
        description: "triagem aguarda questões publicadas (F2-T16)",
      });
    return;
  }
  await form.getByRole("combobox", { name: "Quantidade" }).selectOption("5");
  await form.getByRole("button", { name: "Começar triagem" }).click();
  await page.waitForURL(/\/estudar\/triagem\//);
  const decisions = page.getByRole("group", { name: "Decisão da triagem" });
  await expect(decisions.getByRole("button")).toHaveCount(3);
  // página oculta: o relógio para
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await page.getByRole("timer").innerText();
  await page.waitForTimeout(3000);
  expect(await page.getByRole("timer").innerText()).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // janela de 20 s encerra com aviso e a questão continua na tela
  await expect(page.getByText("Janela encerrada")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: /Triagem 1 de/ }),
  ).toBeVisible();
  await decisions.getByRole("button", { name: "Deixar para depois" }).click();
  await expect(
    page.getByRole("heading", { name: /Triagem 2 de|Triagem concluída/ }),
  ).toBeVisible({ timeout: 15_000 });
});

test("conferência da triagem: sessão alheia ou inexistente não abre", async ({ page }) => {
  await signIn(page);
  const res = await page.goto("/estudar/triagem/00000000-0000-4000-8000-000000000000/conferencia");
  expect(res?.status()).toBe(404);
});
