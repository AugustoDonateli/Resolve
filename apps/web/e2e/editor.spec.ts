import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Revisão editorial (F2-T12) e fronteiras de acesso (F2-T05) pela interface.
 * Usa o lote de teste automatizado (cópias de duas questões, nunca publicado) e as contas
 * de teste: A (aluno) e editor. Requer E2E_EMAIL/E2E_PASSWORD e E2E_EMAIL_EDITOR/E2E_PASSWORD_EDITOR.
 */
const editor = {
  email: process.env.E2E_EMAIL_EDITOR ?? "",
  password: process.env.E2E_PASSWORD_EDITOR ?? "",
};
const student = {
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? "",
};
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
  const t =
    (await page
      .getByText(/^Revisão \d+$/)
      .first()
      .textContent()) ?? "";
  return Number(t.replace(/\D/g, ""));
}

async function openFixture(page: Page) {
  await page.goto("/editor");
  const lote = page.locator("section", {
    has: page.getByRole("heading", { name: /lote de teste automatizado/ }),
  });
  await lote.getByRole("link", { name: "Questão 140" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Questão 140" }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("link", { name: /Revisão editorial/ }),
  ).toHaveCount(0);
});

test("editor corrige o comando e o histórico preserva a versão anterior", async ({
  browser,
}) => {
  const { ctx, page } = await editorPage(browser);
  await page.goto("/mais");
  await expect(
    page.getByRole("link", { name: /Revisão editorial/ }),
  ).toBeVisible();
  await openFixture(page);

  // Lado a lado: a página original carregou (bucket privado, link assinado).
  const img = page
    .getByRole("img", { name: /Página \d+ do caderno original/ })
    .first();
  await expect(img).toBeVisible();
  await expect
    .poll(
      () =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      { timeout: 15_000 },
    )
    .toBe(true);

  const command = page.getByLabel("Comando", { exact: true });
  const original = await command.inputValue();
  const before = await currentRevision(page);
  const stamp = Date.now();
  const marker = ` [teste automatizado ${stamp}]`;
  const note = `teste automatizado ${stamp}: acréscimo no comando`;

  await command.fill(original + marker);
  await page.getByLabel("O que foi corrigido").fill(note);
  await page
    .getByRole("button", { name: `Salvar revisão ${before + 1}` })
    .click();
  await expect(
    page.getByText(`Revisão ${before + 1} salva (comando).`),
  ).toBeVisible({ timeout: 15_000 });

  // Depois de recarregar: revisão nova é a atual e a anterior continua no histórico com o texto antigo.
  await page.reload();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(
    original + marker,
  );
  const history = page.getByRole("region", { name: "Histórico" });
  await expect(
    history.getByText(`Revisão ${before + 1} (atual)`),
  ).toBeVisible();
  await expect(history.getByText(note)).toBeVisible();
  await history.getByRole("link", { name: `Ver revisão ${before}` }).click();
  await expect(
    page.getByText(`Revisão ${before}, somente leitura.`),
  ).toBeVisible();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(
    original,
  );
  await expect(page.getByLabel("Comando", { exact: true })).toBeDisabled();

  // Restaura o texto (mais uma revisão: nada é apagado).
  await page.getByRole("link", { name: /Voltar para a revisão atual/ }).click();
  await page.getByLabel("Comando", { exact: true }).fill(original);
  await page
    .getByLabel("O que foi corrigido")
    .fill("teste automatizado: restaura o comando");
  await page
    .getByRole("button", { name: `Salvar revisão ${before + 2}` })
    .click();
  await expect(
    page.getByText(`Revisão ${before + 2} salva (comando).`),
  ).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("texto com HTML é recusado antes de salvar", async ({ browser }) => {
  const { ctx, page } = await editorPage(browser);
  await openFixture(page);
  const command = page.getByLabel("Comando", { exact: true });
  const original = await command.inputValue();
  await command.fill(`${original} <img src=x onerror=alert(1)>`);
  await expect(
    page.getByText("Texto com marcação HTML não é aceito.").first(),
  ).toBeVisible();
  await page
    .getByLabel("O que foi corrigido")
    .fill("teste automatizado: conteúdo inseguro");
  await page.getByRole("button", { name: /Salvar revisão/ }).click();
  await expect(
    page
      .locator("form [aria-live=polite]")
      .getByText("Texto com marcação HTML não é aceito."),
  ).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByLabel("Comando", { exact: true })).toHaveValue(
    original,
  );
  await ctx.close();
});

test("duas abas editando a mesma revisão: a segunda recebe conflito", async ({
  browser,
}) => {
  const a = await editorPage(browser);
  const b = await editorPage(browser);
  await openFixture(a.page);
  await openFixture(b.page);
  const n = await currentRevision(a.page);
  expect(await currentRevision(b.page)).toBe(n);
  const original = await a.page
    .getByLabel("Comando", { exact: true })
    .inputValue();

  await a.page
    .getByLabel("Comando", { exact: true })
    .fill(`${original} [aba A]`);
  await a.page
    .getByLabel("O que foi corrigido")
    .fill("teste automatizado: aba A");
  await a.page.getByRole("button", { name: `Salvar revisão ${n + 1}` }).click();
  await expect(
    a.page.getByText(`Revisão ${n + 1} salva (comando).`),
  ).toBeVisible({ timeout: 15_000 });

  await b.page
    .getByLabel("Comando", { exact: true })
    .fill(`${original} [aba B]`);
  await b.page
    .getByLabel("O que foi corrigido")
    .fill("teste automatizado: aba B");
  await b.page.getByRole("button", { name: `Salvar revisão ${n + 1}` }).click();
  await expect(b.page.getByText(/Outra correção foi salva/)).toBeVisible({
    timeout: 15_000,
  });
  await b.page.reload();
  await expect(b.page.getByLabel("Comando", { exact: true })).toHaveValue(
    `${original} [aba A]`,
  );

  // Restaura pela aba A.
  await a.page.getByLabel("Comando", { exact: true }).fill(original);
  await a.page
    .getByLabel("O que foi corrigido")
    .fill("teste automatizado: restaura após conflito");
  await a.page.getByRole("button", { name: `Salvar revisão ${n + 2}` }).click();
  await expect(
    a.page.getByText(`Revisão ${n + 2} salva (comando).`),
  ).toBeVisible({ timeout: 15_000 });
  await a.ctx.close();
  await b.ctx.close();
});

async function openTags(page: Page, question: number) {
  await page.goto("/editor");
  const lote = page.locator("section", {
    has: page.getByRole("heading", { name: /lote de teste automatizado/ }),
  });
  await lote
    .getByRole("link", { name: `Questão ${question}`, exact: true })
    .click();
  await page.getByRole("link", { name: "Etiquetas e aprovação" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Etiquetas" }),
  ).toBeVisible();
}

test("etiquetas: aprovar exige campos e checklist; preenchidas, a aprovação é registrada", async ({
  browser,
}) => {
  const { ctx, page } = await editorPage(browser);
  await openTags(page, 10);
  await expect(page.getByText("Gabarito oficial: E")).toBeVisible();

  // O formulário vem com a última decisão (rodadas anteriores): limpa o que o teste preenche.
  await page.getByLabel("Habilidade principal").selectOption("");
  while (
    (await page
      .getByRole("button", { name: /^Remover evidência \d+$/ })
      .count()) > 0
  ) {
    await page
      .getByRole("button", { name: /^Remover evidência \d+$/ })
      .first()
      .click();
  }

  // Sem habilidade e sem checklist: o banco lista o que falta.
  await page.getByRole("button", { name: "Conferir pendências" }).click();
  await expect(page.getByText(/^Pendências \(\d+\):$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("checklist: gabarito conferido contra o oficial"),
  ).toBeVisible();
  await expect(
    page.getByText("habilidade principal ausente ou fora da área"),
  ).toBeVisible();

  await page.getByLabel("Habilidade principal").selectOption("H18");
  await page.getByLabel("1 · conhecimento escolar básico").check();
  await page.getByLabel("Bloco do trecho").selectOption("c1");
  await page
    .getByLabel("Trecho literal (colar)")
    .fill("síntese da opinião da autora");
  await page.getByRole("button", { name: "Adicionar trecho colado" }).click();
  await page
    .getByLabel("Por que este trecho sustenta a resposta (evidência 1)")
    .fill("O comando pede o recurso que marca a síntese.");
  for (const l of ["A", "B", "C", "D"]) {
    await page
      .getByLabel(`Tipo principal (${l})`)
      .selectOption("verdade_fora_do_comando");
    await page
      .getByLabel(`Justificativa editorial (${l})`)
      .fill("Recurso presente no texto que não marca a síntese da opinião.");
  }
  await page
    .getByLabel("Ou: justificativa da ausência de resolução")
    .fill("Resolução comentada fica para o próximo lote (teste automatizado).");

  // Falta só o checklist.
  await page.getByRole("button", { name: "Conferir pendências" }).click();
  await expect(page.getByText("Pendências (7):")).toBeVisible({
    timeout: 15_000,
  });
  for (const c of await page
    .getByRole("group", { name: "Checklist de aprovação" })
    .getByRole("checkbox")
    .all())
    await c.check();
  await page.getByRole("button", { name: "Conferir pendências" }).click();
  await expect(
    page.getByText("Nenhuma pendência: pronta para aprovar."),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Aprovar etiquetas" }).click();
  await expect(
    page
      .getByRole("region", { name: "Decisões anteriores" })
      .getByText(/^Aprovada · conteúdo na revisão \d+$/)
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("etiquetas: devolver ou rejeitar sem motivo é recusado", async ({
  browser,
}) => {
  const { ctx, page } = await editorPage(browser);
  await openTags(page, 10);
  await page.getByRole("button", { name: "Rejeitar questão" }).click();
  await expect(
    page.getByText(
      "Explique o motivo (mínimo de 10 caracteres) para devolver ou rejeitar.",
    ),
  ).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("publicação: lote de teste nunca é publicável e o aluno não chega à tela", async ({
  browser,
}) => {
  const { ctx, page } = await editorPage(browser);
  await page.goto("/editor");
  await page.getByRole("link", { name: "Publicação" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Publicação" }),
  ).toBeVisible();
  await expect(page.getByText(/pronta\(s\) para publicar/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Mostrar motivos" }).click();
  const fixture = page
    .locator("div", {
      has: page.getByRole("heading", {
        level: 3,
        name: /lote de teste automatizado/,
      }),
    })
    .last();
  await expect(
    fixture.getByText("Lote de teste: nunca é publicado."),
  ).toBeVisible();
  await expect(
    fixture.getByText(/lote de teste: não publicável/).first(),
  ).toBeVisible();
  await ctx.close();

  const s = await browser.newContext();
  const sp = await s.newPage();
  await signIn(sp, student);
  expect((await sp.goto("/editor/publicar"))?.status()).toBe(404);
  await s.close();
});

test("área editorial sem violações de acessibilidade (axe)", async ({
  browser,
}) => {
  const { ctx, page } = await editorPage(browser);
  for (const go of [
    () => page.goto("/editor"),
    () => openFixture(page),
    () => openTags(page, 10),
    () => page.goto("/editor/publicar"),
  ]) {
    await go();
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
  await ctx.close();
});

// ── Temas de redação (F5-T03) ──
// O teste cria o próprio rascunho (nunca publica) e o apaga no fim: o tema oficial carregado fica intocado.
async function editorDb() {
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
  const { error } = await db.auth.signInWithPassword(editor);
  if (error) throw error;
  return db;
}

test("temas: conferir texto libera a publicação; mudar a figura devolve a conferência", async ({
  browser,
}) => {
  const db = await editorDb();
  const { data: src } = await db
    .from("sources")
    .select("id")
    .eq(
      "sha256",
      "a0f19f878d4ef3ba94c3e0f5ef9e57c13fb046d4bb362f72651898b473ddb7c8",
    )
    .single();
  const { data: real } = await db
    .from("motivating_texts")
    .select("blocks")
    .eq("position", 2)
    .limit(1)
    .single();
  const figure = (real!.blocks as { type: string; asset_ref?: string }[]).find(
    (b) => b.type === "image",
  )!;
  const { data: prompt, error } = await db
    .from("essay_prompts")
    .insert({
      title: `Tema de teste automatizado ${Date.now()}`,
      instruction: "Rascunho do teste automatizado: nunca publicar.",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  try {
    await db.from("motivating_texts").insert({
      prompt_id: prompt!.id,
      position: 1,
      excerpt: "-",
      source_id: src!.id,
      page_or_locator: "teste",
      citation: "Citação de teste.",
      blocks: [
        { id: "b1", type: "paragraph", text: "Parágrafo de teste." },
        {
          id: "f1",
          type: "image",
          text: "Figura de teste com descrição.",
          asset_ref: figure.asset_ref,
        },
      ],
    });
    const { ctx, page } = await editorPage(browser);
    await page.goto("/editor/temas");
    await page
      .getByRole("link", { name: /Tema de teste automatizado/ })
      .first()
      .click();
    await expect(page.getByText("texto 1 ainda não conferido")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Figura de teste com descrição." }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Confere com o caderno" }).click();
    await expect(page.getByText("Conferido com o caderno")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Publicar tema" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "não muda depois",
    );
    await page.getByRole("button", { name: "Cancelar" }).click(); // o teste nunca publica

    await page
      .getByLabel(/Texto alternativo da figura/)
      .fill("Figura de teste com outra descrição, revisada.");
    await page
      .getByRole("button", { name: "Salvar texto alternativo" })
      .click();
    await expect(
      page.getByRole("button", { name: "Confere com o caderno" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("texto 1 ainda não conferido")).toBeVisible();

    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await ctx.close();
  } finally {
    await db.from("essay_prompts").delete().eq("id", prompt!.id);
  }
  const { data: gone } = await db
    .from("essay_prompts")
    .select("id")
    .eq("id", prompt!.id);
  expect(gone).toEqual([]);
});

test("temas: aluno não chega à revisão e vê só temas publicados", async ({
  page,
}) => {
  await signIn(page, student);
  expect((await page.goto("/editor/temas"))?.status()).toBe(404);
  await page.goto("/redacao");
  await page.getByRole("link", { name: "Temas" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Temas de redação" }),
  ).toBeVisible();
  // o tema oficial carregado ainda é rascunho: o aluno não o vê
  await expect(
    page.getByText("Perspectivas acerca do envelhecimento"),
  ).toHaveCount(0);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("cartões: rascunho com fonte, confirmação de publicar e remoção; aluno não chega", async ({
  browser,
}) => {
  const front = `Cartão de teste automatizado ${Date.now()}`;
  const db = await editorDb();
  try {
    const { ctx, page } = await editorPage(browser);
    await page.goto("/editor/cartoes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Cartões revisados" }),
    ).toBeVisible();

    // sem fonte: recusado antes de gravar
    await page.getByLabel("Frente").fill(front);
    await page.getByLabel("Verso").fill("Verso de teste.");
    await page.getByLabel("Onde está na fonte").fill("teste");
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page.getByText("Escolha a fonte.")).toBeVisible();

    // habilidade fora da matriz: recusada
    await page
      .getByRole("combobox", { name: "Fonte" })
      .selectOption({ label: "Matrizes de Referência – Enem" });
    await page.getByLabel("Habilidade da matriz (opcional)").fill("H99");
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(
      page.getByText(/Habilidade no formato|não encontrada/),
    ).toBeVisible();

    await page.getByLabel("Habilidade da matriz (opcional)").fill("H18");
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page.getByText("Rascunho criado.")).toBeVisible({
      timeout: 15_000,
    });
    const item = page.getByRole("listitem").filter({ hasText: front });
    await expect(item).toContainText("Rascunho · Linguagens · conceito · H18");
    await expect(item).toContainText("Fonte: ");

    await item.getByRole("button", { name: "Revisar e publicar" }).click();
    await expect(item.getByRole("alertdialog")).toContainText(
      "Publicado não muda",
    );
    await item.getByRole("button", { name: "Cancelar" }).click(); // o teste nunca publica

    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    await item.getByRole("button", { name: "Remover rascunho" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: front }),
    ).toHaveCount(0, {
      timeout: 15_000,
    });
    await ctx.close();

    const sctx = await browser.newContext();
    const sp = await sctx.newPage();
    await signIn(sp, student);
    expect((await sp.goto("/editor/cartoes"))?.status()).toBe(404);
    await sctx.close();
  } finally {
    await db
      .from("concept_cards")
      .delete()
      .eq("front", front)
      .eq("status", "rascunho");
  }
  const { data: gone } = await db
    .from("concept_cards")
    .select("id")
    .eq("front", front);
  expect(gone).toEqual([]);
});

test("prévia do aluno: questão real com figuras intacta em 360/390/1440 e figura ampliável", async ({
  browser,
}) => {
  const db = await editorDb();
  const { data: batches } = await db
    .from("ingest_batches")
    .select("id")
    .eq("publishable", true);
  const { data: props } = await db
    .from("item_proposals")
    .select("id, payload")
    .eq("question_number", 119)
    .in(
      "batch_id",
      (batches ?? []).map((b) => b.id),
    );
  const q = (props ?? []).find(
    (p) => (p.payload as { source: { booklet: number } }).source.booklet === 7,
  );
  expect(q, "Q119 do caderno 7 carregada").toBeTruthy();
  const { ctx, page } = await editorPage(browser);
  await page.goto(`/editor/proposta/${q!.id}`);
  await page.getByRole("link", { name: "Prévia do aluno" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Prévia do aluno" }),
  ).toBeVisible();
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByText(
        "O diagrama que representa o circuito construído pelo eletrotécnico é:",
      ),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);
    // figuras carregadas (texto-base e as cinco alternativas): rola até o fim para o carregamento preguiçoso
    await page.locator("[data-alt]").last().scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          page
            .locator("article img")
            .evaluateAll(
              (imgs) =>
                imgs.filter(
                  (i) =>
                    (i as HTMLImageElement).complete &&
                    (i as HTMLImageElement).naturalWidth > 0,
                ).length,
            ),
        { message: `figuras carregadas em ${width}px`, timeout: 15_000 },
      )
      .toBe(6);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `rolagem horizontal em ${width}px`).toBeLessThanOrEqual(0);
    // alternativas inteiras dentro da coluna
    const outside = await page
      .locator("[data-alt]")
      .evaluateAll(
        (els) =>
          els.filter(
            (e) =>
              e.getBoundingClientRect().right >
              document.documentElement.clientWidth + 0.5,
          ).length,
      );
    expect(outside, `alternativa cortada em ${width}px`).toBe(0);
  }
  await page.getByRole("button", { name: "Ampliar figura 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Figura 1 ampliada" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ampliar figura 1" }),
  ).toBeFocused();
  // marcar uma alternativa não revela gabarito
  await page.getByRole("radio").nth(1).click();
  await expect(page.getByText("Correta", { exact: true })).toHaveCount(0);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await ctx.close();
});

test("ocorrências: editor vê a fila; aluno não chega", async ({ browser }) => {
  const { ctx, page } = await editorPage(browser);
  await page.goto("/editor");
  await page.getByRole("link", { name: "Ocorrências" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ocorrências" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fechar uma ocorrência não muda a questão", {
      exact: false,
    }),
  ).toBeVisible();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await ctx.close();
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await signIn(sp, student);
  expect((await sp.goto("/editor/ocorrencias"))?.status()).toBe(404);
  await sctx.close();
});
