import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Revisão editorial (F2-T12) e fronteiras de acesso (F2-T05) pela interface.
 * Usa o lote de teste automatizado (cópias de duas questões, nunca publicado) e as contas
 * de teste: A (aluno) e editor. Requer E2E_EMAIL/E2E_PASSWORD e E2E_EMAIL_EDITOR/E2E_PASSWORD_EDITOR.
 */
const editor = { email: process.env.E2E_EMAIL_EDITOR ?? "", password: process.env.E2E_PASSWORD_EDITOR ?? "" };
const student = { email: process.env.E2E_EMAIL ?? "", password: process.env.E2E_PASSWORD ?? "" };
test.skip(!editor.email || !student.email, "credenciais de teste ausentes");
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
}

async function editorPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, editor);
  return { ctx, page };
}

async function currentRevision(page: Page) {
  const t = (await page.getByText(/^Revisão \d+$/).first().textContent()) ?? "";
  return Number(t.replace(/\D/g, ""));
}

async function openFixture(page: Page) {
  await page.goto("/editor");
  const lote = page.locator("section", { has: page.getByRole("heading", { name: /lote de teste automatizado/ }) });
  await lote.getByRole("link", { name: "Questão 140" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Questão 140" })).toBeVisible();
}

test("visitante é levado a Entrar", async ({ page }) => {
  await page.goto("/editor");
  await expect(page).toHaveURL(/\/entrar\?next=%2Feditor/);
});

test("aluno não vê a área editorial nem o atalho", async ({ page }) => {
  await signIn(page, student);
  const res = await page.goto("/editor");
  expect(res?.status()).toBe(404);
  await page.goto("/mais");
  await expect(page.getByRole("link", { name: /Revisão editorial/ })).toHaveCount(0);
});

test("editor corrige o comando e o histórico preserva a versão anterior", async ({ browser }) => {
  const { ctx, page } = await editorPage(browser);
  await page.goto("/mais");
  await expect(page.getByRole("link", { name: /Revisão editorial/ })).toBeVisible();
  await openFixture(page);

  // Lado a lado: a página original carregou (bucket privado, link assinado).
  const img = page.getByRole("img", { name: /Página \d+ do caderno original/ }).first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);

  const command = page.getByLabel("Comando", { exact: true });
  const original = await command.inputValue();
  const before = await currentRevision(page);
  const stamp = Date.now();
  const marker = ` [teste automatizado ${stamp}]`;
  const note = `teste automatizado ${stamp}: acréscimo no comando`;

  await command.fill(original + marker);
  await page.getByLabel("O que foi corrigido").fill(note);
  await page.getByRole("button", { name: `Salvar revisão ${before + 1}` }).click();
  await expect(page.getByText(`Revisão ${before + 1} salva (comando).`)).toBeVisible({ timeout: 15_000 });

  // Depois de recarregar: revisão nova é a atual e a anterior continua no histórico com o texto antigo.
  await page.reload();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(original + marker);
  const history = page.getByRole("region", { name: "Histórico" });
  await expect(history.getByText(`Revisão ${before + 1} (atual)`)).toBeVisible();
  await expect(history.getByText(note)).toBeVisible();
  await history.getByRole("link", { name: `Ver revisão ${before}` }).click();
  await expect(page.getByText(`Revisão ${before}, somente leitura.`)).toBeVisible();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(original);
  await expect(page.getByLabel("Comando", { exact: true })).toBeDisabled();

  // Restaura o texto (mais uma revisão: nada é apagado).
  await page.getByRole("link", { name: /Voltar para a revisão atual/ }).click();
  await page.getByLabel("Comando", { exact: true }).fill(original);
  await page.getByLabel("O que foi corrigido").fill("teste automatizado: restaura o comando");
  await page.getByRole("button", { name: `Salvar revisão ${before + 2}` }).click();
  await expect(page.getByText(`Revisão ${before + 2} salva (comando).`)).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("texto com HTML é recusado antes de salvar", async ({ browser }) => {
  const { ctx, page } = await editorPage(browser);
  await openFixture(page);
  const command = page.getByLabel("Comando", { exact: true });
  const original = await command.inputValue();
  await command.fill(`${original} <img src=x onerror=alert(1)>`);
  await expect(page.getByText("Texto com marcação HTML não é aceito.").first()).toBeVisible();
  await page.getByLabel("O que foi corrigido").fill("teste automatizado: conteúdo inseguro");
  await page.getByRole("button", { name: /Salvar revisão/ }).click();
  await expect(page.locator("form [aria-live=polite]").getByText("Texto com marcação HTML não é aceito.")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(original);
  await ctx.close();
});

test("duas abas editando a mesma revisão: a segunda recebe conflito", async ({ browser }) => {
  const a = await editorPage(browser);
  const b = await editorPage(browser);
  await openFixture(a.page);
  await openFixture(b.page);
  const n = await currentRevision(a.page);
  expect(await currentRevision(b.page)).toBe(n);
  const original = await a.page.getByLabel("Comando", { exact: true }).inputValue();

  await a.page.getByLabel("Comando", { exact: true }).fill(`${original} [aba A]`);
  await a.page.getByLabel("O que foi corrigido").fill("teste automatizado: aba A");
  await a.page.getByRole("button", { name: `Salvar revisão ${n + 1}` }).click();
  await expect(a.page.getByText(`Revisão ${n + 1} salva (comando).`)).toBeVisible({ timeout: 15_000 });

  await b.page.getByLabel("Comando", { exact: true }).fill(`${original} [aba B]`);
  await b.page.getByLabel("O que foi corrigido").fill("teste automatizado: aba B");
  await b.page.getByRole("button", { name: `Salvar revisão ${n + 1}` }).click();
  await expect(b.page.getByText(/Outra correção foi salva/)).toBeVisible({ timeout: 15_000 });
  await b.page.reload();
  await expect(b.page.getByLabel("Comando", { exact: true })).toHaveValue(`${original} [aba A]`);

  // Restaura pela aba A.
  await a.page.getByLabel("Comando", { exact: true }).fill(original);
  await a.page.getByLabel("O que foi corrigido").fill("teste automatizado: restaura após conflito");
  await a.page.getByRole("button", { name: `Salvar revisão ${n + 2}` }).click();
  await expect(a.page.getByText(`Revisão ${n + 2} salva (comando).`)).toBeVisible({ timeout: 15_000 });
  await a.ctx.close();
  await b.ctx.close();
});

test("área editorial sem violações de acessibilidade (axe)", async ({ browser }) => {
  const { ctx, page } = await editorPage(browser);
  for (const go of [() => page.goto("/editor"), () => openFixture(page)]) {
    await go();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
  await ctx.close();
});
