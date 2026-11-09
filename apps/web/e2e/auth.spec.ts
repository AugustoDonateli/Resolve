import { expect, test } from "@playwright/test";

/**
 * Conta pessoal (F2-T01): entrar, recarregar, preferências na conta, sair,
 * cadastro fechado e destino seguro. Usa a conta de teste B (a auditoria usa A).
 * Requer E2E_EMAIL_B/E2E_PASSWORD_B e um build com Supabase configurado.
 */
const email = process.env.E2E_EMAIL_B ?? "";
const password = process.env.E2E_PASSWORD_B ?? "";
test.skip(!email || !password, "credenciais de teste ausentes");
test.describe.configure({ mode: "serial" });

async function signIn(page: import("@playwright/test").Page, pw = password) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("tela protegida leva a Entrar e volta ao destino após o login", async ({ page }) => {
  await page.goto("/redacao");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fredacao/);
  await signIn(page);
  await expect(page).toHaveURL(/\/redacao$/);
});

test("senha errada mostra o que fazer e conserva o e-mail", async ({ page }) => {
  await page.goto("/entrar");
  await signIn(page, "senha-errada-123");
  await expect(page.getByText("E-mail ou senha não conferem")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
});

test("recarregar preserva a sessão; sair encerra", async ({ page }) => {
  await page.goto("/entrar");
  await signIn(page);
  await page.waitForURL("**/hoje");
  await page.reload();
  await expect(page).toHaveURL(/\/hoje$/);
  await page.goto("/mais");
  await expect(page.getByTestId("account-email")).toHaveText(email);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/hoje");
  await expect(page).toHaveURL(/\/entrar/);
});

test("preferência salva na conta vale em outro aparelho", async ({ browser }) => {
  const one = await browser.newContext();
  const p1 = await one.newPage();
  await p1.goto("/entrar");
  await signIn(p1);
  await p1.waitForURL("**/hoje");
  await p1.goto("/mais");
  await p1.getByText("Escuro", { exact: true }).click();
  await p1.getByText("22 px", { exact: true }).click();
  await expect(p1.getByTestId("prefs-sync")).toHaveText("Salvo na conta.", { timeout: 10_000 });
  await one.close();

  // "Outro aparelho": contexto novo, sem armazenamento local.
  const two = await browser.newContext({ colorScheme: "light" });
  const p2 = await two.newPage();
  await p2.goto("/entrar");
  await signIn(p2);
  await p2.waitForURL("**/hoje");
  await expect(p2.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(p2.locator("html")).toHaveAttribute("data-text-scale", "22");

  // Restaura o padrão da conta de teste.
  await p2.goto("/mais");
  await p2.getByText("Sistema", { exact: true }).click();
  await p2.getByText("18 px", { exact: true }).click();
  await expect(p2.getByTestId("prefs-sync")).toHaveText("Salvo na conta.", { timeout: 10_000 });
  await p2.reload();
  await expect(p2.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await two.close();
});

test("cadastro de e-mail não liberado é recusado com mensagem clara", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByText("Criar conta", { exact: true }).click();
  await page.getByLabel("E-mail").fill("sem-convite@resolve.test");
  await page.getByLabel("Senha", { exact: true }).fill("umasenhalonga123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Este e-mail não está liberado para criar conta no Resolve.")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue("sem-convite@resolve.test");
});

test("destino externo após o login é ignorado", async ({ page }) => {
  await page.goto("/entrar?next=//evil.example");
  await signIn(page);
  await expect(page).toHaveURL(/localhost:3100\/hoje$/);
});
