import { test as setup } from "@playwright/test";
import fs from "node:fs";
import { AUTH_FILE } from "./session";

/**
 * Entra com a conta de teste A e guarda a sessão para a auditoria.
 * Sem E2E_EMAIL/E2E_PASSWORD (modo local, sem Supabase), grava sessão vazia.
 */
setup("sessão da auditoria", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
  await page.context().storageState({ path: AUTH_FILE });
});
