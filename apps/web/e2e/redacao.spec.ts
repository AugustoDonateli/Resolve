import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Editor de redação (F5-T05) com a conta de teste A: salva sozinho, recupera ao recarregar e ao voltar a
 * conexão, e conflito entre dois aparelhos não sobrescreve em silêncio. Apaga as redações de A no fim.
 */
const student = {
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? "",
};
test.skip(!student.email, "credenciais de teste ausentes");
test.describe.configure({ mode: "serial" });

async function studentDb() {
  const { readFileSync, existsSync } = await import("node:fs");
  const { createClient } = await import("@supabase/supabase-js");
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  const file = new URL("../.env.local", import.meta.url);
  if (existsSync(file))
    for (const l of readFileSync(file, "utf8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m?.[1] && m[2] !== undefined && !env[m[1]]) env[m[1]] = m[2];
    }
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
  const { error } = await db.auth.signInWithPassword(student);
  if (error) throw error;
  return db;
}

async function signIn(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(student.email);
  await page.getByLabel("Senha", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
}

async function device(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page);
  return { ctx, page };
}

const saved = (page: Page) =>
  expect(
    page.getByRole("status").filter({ hasText: "Salvo na sua conta." }),
  ).toBeVisible({ timeout: 15_000 });

test("redação: salva sozinho, recupera ao recarregar e ao voltar a conexão; conflito pede escolha", async ({
  browser,
}) => {
  const db = await studentDb();
  const wipe = async () =>
    void (await db.from("essays").delete().not("id", "is", null));
  await wipe();
  try {
    const a = await device(browser);
    await a.page.goto("/redacao");
    await a.page.getByRole("link", { name: "Minhas redações" }).click();
    await a.page.getByRole("button", { name: "Nova redação" }).click();
    await a.page.waitForURL(/\/redacao\/escrever\//);
    const url = a.page.url();
    const box = a.page.getByLabel("Texto da redação");
    await box.fill(
      "Primeiro parágrafo da introdução.\n\nSegundo parágrafo, desenvolvimento.",
    );
    await expect(
      a.page.getByText("7 palavras · 2 parágrafos", { exact: false }),
    ).toBeVisible();
    await saved(a.page);

    // recarregar recupera do servidor
    await a.page.reload();
    await expect(a.page.getByLabel("Texto da redação")).toHaveValue(
      "Primeiro parágrafo da introdução.\n\nSegundo parágrafo, desenvolvimento.",
    );

    // recarregar antes do salvamento automático: a cópia do aparelho volta e é salva
    await a.page.getByLabel("Texto da redação").press("Control+End");
    await a.page
      .getByLabel("Texto da redação")
      .pressSequentially(" Mais", { delay: 10 });
    await a.page.reload();
    await expect(a.page.getByLabel("Texto da redação")).toHaveValue(
      /desenvolvimento\. Mais$/,
    );
    await saved(a.page);

    // sem conexão: guarda no aparelho; ao voltar, salva
    await a.ctx.setOffline(true);
    await a.page
      .getByLabel("Texto da redação")
      .pressSequentially(" Offline", { delay: 10 });
    await expect(
      a.page.getByText(/Sem conexão: o texto está guardado neste aparelho/),
    ).toBeVisible({ timeout: 15_000 });
    await a.ctx.setOffline(false);
    await a.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await saved(a.page);
    const { data: v1 } = await db
      .from("essay_versions")
      .select("plain_text")
      .limit(1)
      .single();
    expect(v1?.plain_text).toMatch(/Mais Offline$/);

    // conflito: o segundo aparelho abriu antes e grava depois
    const b = await device(browser);
    await b.page.goto(url);
    await expect(b.page.getByLabel("Texto da redação")).toHaveValue(
      /Mais Offline$/,
    );
    await a.page.getByLabel("Texto da redação").fill("Versão do aparelho A.");
    await saved(a.page);
    await b.page.getByLabel("Texto da redação").fill("Versão do aparelho B.");
    await expect(
      b.page.getByRole("heading", { name: "Duas versões do rascunho" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(b.page.getByLabel("A salva em outro lugar")).toHaveValue(
      "Versão do aparelho A.",
    );
    const { data: still } = await db
      .from("essay_versions")
      .select("plain_text")
      .limit(1)
      .single();
    expect(still?.plain_text).toBe("Versão do aparelho A."); // nada sobrescrito em silêncio
    const r = await new AxeBuilder({ page: b.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await b.page.getByRole("button", { name: "Manter a minha" }).click();
    await saved(b.page);
    const { data: final } = await db
      .from("essay_versions")
      .select("plain_text")
      .limit(1)
      .single();
    expect(final?.plain_text).toBe("Versão do aparelho B.");
    await a.ctx.close();
    await b.ctx.close();
  } finally {
    await wipe();
  }
});

test("folha simulada: mesma contagem no celular e no PC, prévia ampliável e limite explicado", async ({
  browser,
}) => {
  const db = await studentDb();
  const wipe = async () =>
    void (await db.from("essays").delete().not("id", "is", null));
  await wipe();
  try {
    const a = await device(browser);
    await a.page.goto("/redacao/minhas");
    await a.page.getByRole("button", { name: "Nova redação" }).click();
    await a.page.waitForURL(/\/redacao\/escrever\//);
    const long = Array.from(
      { length: 12 },
      () => "A participação social amplia a cidadania.",
    ).join(" ");
    await a.page
      .getByLabel("Texto da redação")
      .fill(`${long}\n\nSegundo parágrafo.`);
    await saved(a.page);
    const counts: string[] = [];
    for (const width of [390, 1440]) {
      await a.page.setViewportSize({ width, height: 900 });
      counts.push(
        await a.page.getByText(/^Folha simulada: \d+ de 30 linhas/).innerText(),
      );
    }
    expect(counts[0]).toBe(counts[1]);
    await expect(
      a.page.getByText(/não prevê quantas linhas a sua letra ocupa/),
    ).toBeVisible();
    const lines = Number(counts[0]!.match(/(\d+) de 30/)![1]);
    const { data: v } = await db
      .from("essay_versions")
      .select("simulated_lines, layout_profile_id")
      .limit(1)
      .single();
    expect(v?.simulated_lines).toBe(lines);
    expect(v?.layout_profile_id).toBeTruthy();

    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.getByRole("button", { name: "Ver a folha" }).click();
    const dialog = a.page.getByRole("dialog", { name: /Folha simulada/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("ol > li")).toHaveCount(30);
    const before = await dialog
      .locator("ol")
      .evaluate((el) => getComputedStyle(el).fontSize);
    await dialog.getByRole("button", { name: "Ampliar a folha" }).click();
    expect(
      await dialog
        .locator("ol")
        .evaluate((el) => getComputedStyle(el).fontSize),
    ).not.toBe(before);
    const r = await new AxeBuilder({ page: a.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((x) => `${x.id}: ${x.nodes.length}`)).toEqual([]);
    await a.page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await a.ctx.close();
  } finally {
    await wipe();
  }
});

test("treino por peças: quatro modos, intervenção com dez minutos e sem nota total", async ({
  browser,
}) => {
  const db = await studentDb();
  const wipe = async () =>
    void (await db.from("essays").delete().not("id", "is", null));
  await wipe();
  try {
    const a = await device(browser);
    await a.page.goto("/redacao");
    await a.page.getByRole("link", { name: "Treino por peças" }).click();
    const form = a.page.getByRole("form", { name: "Escolher peça" });
    await expect(form.getByRole("radio")).toHaveCount(4);
    for (const name of [/^Introdução/, /^Desenvolvimento/, /^Conclusão/, /^Proposta de intervenção/])
      await expect(form.getByRole("radio", { name })).toBeVisible();
    await form.getByRole("radio", { name: /Proposta de intervenção/ }).check();
    await form.getByRole("button", { name: "Começar a peça" }).click();
    await a.page.waitForURL(/\/redacao\/escrever\//);
    await expect(
      a.page.getByText("Peça: Proposta de intervenção"),
    ).toBeVisible();
    await expect(
      a.page.getByText(
        /agente \(quem\), ação \(o quê\), meio \(como\), finalidade \(para quê\) e detalhamento/,
      ),
    ).toBeVisible();
    await a.page.getByRole("button", { name: "Iniciar 10 minutos" }).click();
    await expect(
      a.page
        .getByRole("group", { name: "Tempo da peça" })
        .getByText("Cronometrando."),
    ).toBeVisible();
    await a.page
      .getByLabel("Texto da redação")
      .fill(
        "O Ministério da Educação deve criar programas de leitura, por meio de parcerias com escolas, a fim de ampliar o acesso.",
      );
    await saved(a.page);
    await a.page.reload();
    await expect(
      a.page
        .getByRole("group", { name: "Tempo da peça" })
        .getByText("Cronometrando."),
    ).toBeVisible();
    await expect(a.page.getByText(/Folha simulada/)).toHaveCount(0);
    await expect(
      a.page.getByRole("main").getByText(/\bnota\b|pontos/i),
    ).toHaveCount(0);
    const { data: e } = await db
      .from("essays")
      .select("training_piece")
      .limit(1)
      .single();
    expect(e?.training_piece).toBe("intervencao");
    const r = await new AxeBuilder({ page: a.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((x) => `${x.id}: ${x.nodes.length}`)).toEqual([]);
    await a.ctx.close();
  } finally {
    await wipe();
  }
});
