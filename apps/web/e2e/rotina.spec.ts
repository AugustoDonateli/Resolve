import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Rotina (F4-T13) pela interface, com a conta de teste A: horário livre e compromisso semanais,
 * conflito explicado, cancelar e mudar um único dia sem alterar a regra, desfazer e remover.
 * Limpa as próprias regras antes e depois.
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
    {
      auth: { persistSession: false },
    },
  );
  const { error } = await db.auth.signInWithPassword(student);
  if (error) throw error;
  return db;
}

async function clean() {
  const db = await studentDb();
  await db.from("schedule_exceptions").delete().not("id", "is", null);
  await db.from("fixed_commitments").delete().not("id", "is", null);
  await db.from("availability_rules").delete().not("id", "is", null);
  const counts = await Promise.all(
    ["availability_rules", "fixed_commitments", "schedule_exceptions"].map(
      async (t) => (await db.from(t).select("id")).data?.length ?? -1,
    ),
  );
  return counts;
}

async function signIn(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(student.email);
  await page.getByLabel("Senha", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje");
}

async function addWeekly(
  page: Page,
  kind: string,
  title: string | null,
  weekday: string,
  start: string,
  end: string,
) {
  const form = page.getByRole("form", { name: "Novo horário semanal" });
  await form.getByLabel("Tipo").selectOption({ label: kind });
  await form.getByLabel("Dia da semana").selectOption({ label: weekday });
  if (title) await form.getByLabel("Nome do compromisso").fill(title);
  await form.getByLabel("Início").fill(start);
  await form.getByLabel("Fim").fill(end);
  await form.getByRole("button", { name: "Adicionar toda semana" }).click();
}

test("rotina: semana, conflito explicado e mudança de um dia sem alterar a regra", async ({
  page,
}) => {
  expect(await clean()).toEqual([0, 0, 0]);
  try {
    await signIn(page);
    await page.goto("/rotina");
    await expect(
      page.getByRole("heading", { level: 1, name: "Rotina e metas" }),
    ).toBeVisible();
    await expect(page.getByText("Nenhum horário ainda.")).toBeVisible();

    await addWeekly(
      page,
      "Horário livre para estudar",
      null,
      "Segunda",
      "18:00",
      "22:00",
    );
    await expect(page.getByText("Horário criado.")).toBeVisible({
      timeout: 15_000,
    });
    await addWeekly(
      page,
      "Compromisso fixo",
      "Aula de teste",
      "Segunda",
      "19:00",
      "20:00",
    );
    await expect(
      page.getByText("Segunda, 19:00–20:00 · Aula de teste"),
    ).toBeVisible({ timeout: 15_000 });

    // fim antes do início: recusado antes de gravar
    await addWeekly(
      page,
      "Compromisso fixo",
      "Invertido",
      "Terça",
      "10:00",
      "09:00",
    );
    await expect(
      page.getByText(/O fim precisa ser depois do início/),
    ).toBeVisible();

    // sobreposição: o banco recusa e diz com o quê
    await addWeekly(
      page,
      "Compromisso fixo",
      "Futebol",
      "Segunda",
      "19:30",
      "20:30",
    );
    await expect(
      page.getByText(
        /Colide com o compromisso Aula de teste em \d{2}\/\d{2}\/\d{4}, das 19:00 às 20:00/,
      ),
    ).toBeVisible({
      timeout: 15_000,
    });

    const week = page.getByRole("region", { name: "Próximos 7 dias" });
    // ocorrência = item sem título de dia (o item do dia também contém o texto)
    const occ = (text: string) =>
      week
        .getByRole("listitem")
        .filter({ hasText: text, hasNot: page.getByRole("heading") });
    const aula = occ("19:00–20:00 · Aula de teste");
    await expect(aula).toHaveCount(1);

    // cancelar só neste dia
    await aula.getByRole("button", { name: "Cancelar só neste dia" }).click();
    await expect(week.getByText("cancelado só neste dia")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText("Segunda, 19:00–20:00 · Aula de teste"),
    ).toBeVisible(); // a regra continua
    await week.getByRole("button", { name: "Desfazer cancelamento" }).click();
    await expect(occ("19:00–20:00 · Aula de teste")).toHaveCount(1, {
      timeout: 15_000,
    });

    // mudar só neste dia
    await occ("19:00–20:00 · Aula de teste")
      .getByRole("button", { name: "Mudar só neste dia" })
      .click();
    await week.getByLabel("Início").fill("20:30");
    await week.getByLabel("Fim").fill("21:30");
    await week.getByRole("button", { name: "Salvar só neste dia" }).click();
    const moved = occ("20:30–21:30 · Aula de teste");
    await expect(moved).toContainText("mudado só neste dia", {
      timeout: 15_000,
    });
    await expect(
      page.getByText("Segunda, 19:00–20:00 · Aula de teste"),
    ).toBeVisible();

    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        r.violations.map((v) => `${width}px ${v.id}: ${v.nodes.length}`),
      ).toEqual([]);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `rolagem horizontal em ${width}px`).toBeLessThanOrEqual(
        0,
      );
    }

    await moved.getByRole("button", { name: "Desfazer mudança" }).click();
    await expect(occ("19:00–20:00 · Aula de teste")).toHaveCount(1, {
      timeout: 15_000,
    });

    // remover a regra inteira (com confirmação)
    const rule = page
      .getByRole("listitem")
      .filter({ hasText: "Segunda, 19:00–20:00 · Aula de teste" });
    await rule
      .getByRole("button", { name: "Remover de todas as semanas" })
      .click();
    await rule.getByRole("button", { name: "Remover", exact: true }).click();
    await expect(
      page.getByText("Segunda, 19:00–20:00 · Aula de teste"),
    ).toHaveCount(0, { timeout: 15_000 });
  } finally {
    expect(await clean()).toEqual([0, 0, 0]);
  }
});

test("rotina: visitante é levado a Entrar", async ({ page }) => {
  await page.goto("/rotina");
  await expect(page).toHaveURL(/\/entrar/);
});

test("metas e planos se-então: criar, editar, arquivar e restaurar", async ({
  page,
}) => {
  const db = await studentDb();
  const wipe = async () => {
    await db.from("goals").delete().not("id", "is", null);
    await db.from("if_then_plans").delete().not("id", "is", null);
  };
  await wipe();
  try {
    await signIn(page);
    await page.goto("/rotina");
    const goalForm = page.getByRole("form", { name: "Nova meta" });
    await goalForm.getByLabel("Minutos por dia", { exact: true }).fill("60");
    await goalForm.getByRole("button", { name: "Criar meta" }).click();
    const daily = page
      .getByRole("listitem")
      .filter({ hasText: "Meta diária · 1 h por dia" });
    await expect(daily).toBeVisible({ timeout: 15_000 });

    await goalForm
      .getByRole("combobox", { name: "Tipo de meta" })
      .selectOption("area");
    await goalForm.getByRole("combobox", { name: "Área" }).selectOption("MT");
    await goalForm.getByLabel("Nota-alvo (0 a 1000)").fill("750");
    await goalForm
      .getByLabel("Minutos por semana", { exact: true })
      .fill("180");
    await goalForm.getByRole("button", { name: "Criar meta" }).click();
    await expect(
      page.getByText(
        "Meta por área · Matemática · nota-alvo 750 · 3 h por semana",
      ),
    ).toBeVisible({ timeout: 15_000 });

    // segunda meta diária ativa: recusada com explicação
    await goalForm
      .getByRole("combobox", { name: "Tipo de meta" })
      .selectOption("diaria");
    await goalForm.getByLabel("Minutos por dia", { exact: true }).fill("30");
    await goalForm.getByRole("button", { name: "Criar meta" }).click();
    await expect(
      page.getByText("Já há uma meta ativa desse tipo. Arquive a atual antes."),
    ).toBeVisible({ timeout: 15_000 });

    // editar
    await daily.getByRole("button", { name: "Editar" }).click();
    await daily.getByLabel("Minutos por dia", { exact: true }).fill("90");
    await daily.getByRole("button", { name: "Salvar meta" }).click();
    const edited = page
      .getByRole("listitem")
      .filter({ hasText: "Meta diária · 1 h 30 min por dia" });
    await expect(edited).toBeVisible({ timeout: 15_000 });

    // plano se-então
    const planForm = page.getByRole("form", { name: "Novo plano se-então" });
    await planForm.getByLabel("Se…").fill("Se eu chegar cansado do trabalho");
    await planForm.getByLabel("Então…").fill("faço 10 minutos de revisão");
    await planForm.getByLabel("Duração (minutos)").fill("10");
    await planForm.getByRole("button", { name: "Criar plano" }).click();
    const plan = page.getByRole("listitem").filter({
      hasText:
        "Se eu chegar cansado do trabalho, então faço 10 minutos de revisão",
    });
    await expect(plan).toBeVisible({ timeout: 15_000 });

    // arquivar e restaurar: a meta volta com o valor editado
    await edited.getByRole("button", { name: "Arquivar" }).click();
    const archived = page.getByRole("region", { name: "Arquivadas" });
    await expect(
      archived.getByText("Meta diária · 1 h 30 min por dia"),
    ).toBeVisible({ timeout: 15_000 });
    await archived.getByRole("button", { name: "Restaurar" }).click();
    await expect(
      page
        .getByRole("region", { name: "Metas" })
        .getByText("Meta diária · 1 h 30 min por dia"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(plan).toBeVisible();
  } finally {
    await wipe();
  }
});

test("plano de hoje: blocos nos horários livres, sem encostar no compromisso, e o que ficou de fora", async ({
  page,
}) => {
  test.setTimeout(120_000); // plano + remarcação + arrasto + foco: fluxo longo
  const db = await studentDb();
  const wipe = async () => {
    await db.from("study_blocks").delete().not("id", "is", null); // intervalos de foco saem em cascata
    await db.from("study_plan_days").delete().not("local_date", "is", null);
    await db.from("goals").delete().not("id", "is", null);
    await db.from("schedule_exceptions").delete().not("id", "is", null);
    await db.from("fixed_commitments").delete().not("id", "is", null);
    await db.from("availability_rules").delete().not("id", "is", null);
  };
  await wipe();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const now =
    Number(parts.find((p) => p.type === "hour")!.value) * 60 +
    Number(parts.find((p) => p.type === "minute")!.value);
  test.skip(
    now > 21 * 60,
    "perto da meia-noite em São Paulo: sem espaço para planejar hoje",
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")!.value,
  );
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const cStart = Math.ceil((now + 40) / 5) * 5;
  try {
    expect(
      (
        await db
          .from("availability_rules")
          .insert({ weekday, start_time: "00:00", end_time: "23:55" })
      ).error,
    ).toBeNull();
    expect(
      (
        await db.from("fixed_commitments").insert({
          title: "Compromisso de teste",
          weekday,
          start_time: hhmm(cStart),
          end_time: hhmm(cStart + 30),
        })
      ).error,
    ).toBeNull();
    expect(
      (await db.from("goals").insert({ level: "diaria", target_minutes: 60 }))
        .error,
    ).toBeNull();
    await signIn(page);
    await page.goto("/hoje");
    await page.getByRole("button", { name: "Montar plano de hoje" }).click();
    await expect(page.getByText("Plano montado.")).toBeVisible({
      timeout: 15_000,
    });
    const plan = page.getByRole("region", { name: "Plano de hoje" });
    // com respostas na conta, o plano adaptativo escolhe uma área ("Treino de …"); sem elas, "Treino livre"
    await expect(plan.getByText(/Treino (livre|de )/).first()).toBeVisible();
    const { data: blocks } = await db
      .from("study_blocks")
      .select("start_minute, planned_minutes, reason");
    // o motivo fica gravado no bloco (na tela aparece só no bloco em destaque, que pode ser a revisão)
    expect((blocks ?? []).some((b) => /Completa a meta de 60 min por dia/.test(b.reason ?? ""))).toBe(true);
    expect((blocks ?? []).reduce((a, b) => a + b.planned_minutes, 0)).toBe(60);
    for (const b of blocks ?? []) {
      expect(b.start_minute).toBeGreaterThanOrEqual(now);
      const overlaps =
        b.start_minute < cStart + 30 &&
        cStart < b.start_minute + b.planned_minutes;
      expect(overlaps, `bloco ${b.start_minute} encosta no compromisso`).toBe(
        false,
      );
    }
    // Remarcação (F4-T16) por formulário: o horário do compromisso não é oferecido; outro horário grava.
    const { data: before } = await db
      .from("study_blocks")
      .select("id, title, start_minute, planned_minutes")
      .order("start_minute");
    // o bloco aberto abaixo é o primeiro de treino (com revisão vencida, o primeiro do dia é a revisão)
    const first = before!.find((b) => /^Treino/.test(b.title))!;
    await page
      .locator("[data-block]")
      .filter({ hasText: /Treino (livre|de )/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: /Remarcar/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: hhmm(cStart), exact: true }),
    ).toHaveCount(0);
    const options = dialog.getByRole("radio");
    const n = await options.count();
    let target = -1;
    for (let i = 0; i < n; i++) {
      const label =
        (await options
          .nth(i)
          .evaluate((el) => (el as HTMLInputElement).value)) ?? "";
      if (Number(label) !== first.start_minute) {
        target = Number(label);
        await dialog.locator("label").nth(i).click();
        await expect(options.nth(i)).toBeChecked();
        break;
      }
    }
    expect(target).toBeGreaterThanOrEqual(now); // nada no passado
    await dialog.getByRole("button", { name: /Remarcar para/ }).click();
    await expect
      .poll(
        async () =>
          (
            await db
              .from("study_blocks")
              .select("start_minute")
              .eq("id", first.id)
              .single()
          ).data?.start_minute,
        { timeout: 15_000 },
      )
      .toBe(target);
    const moved = (
      await db
        .from("study_blocks")
        .select("start_minute, planned_minutes")
        .eq("id", first.id)
        .single()
    ).data!;
    expect(
      moved.start_minute < cStart + 30 &&
        cStart < moved.start_minute + moved.planned_minutes,
    ).toBe(false);

    // Arrastar para cima do compromisso: recusado com explicação, nada gravado.
    await page.reload();
    const blockEl = page.locator(`[data-block="${first.id}"]`);
    await page.setViewportSize({ width: 1280, height: 1400 });
    await blockEl.scrollIntoViewIfNeeded();
    const box = (await blockEl.boundingBox())!;
    const dy = (cStart - target) * 1.6;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + dy / 2, {
      steps: 5,
    });
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + dy, { steps: 5 });
    await page.mouse.up();
    await expect(
      page.getByRole("region", { name: "Agenda de hoje" }),
    ).toContainText(/colide com/i);
    expect(
      (
        await db
          .from("study_blocks")
          .select("start_minute")
          .eq("id", first.id)
          .single()
      ).data?.start_minute,
    ).toBe(target);

    // refazer não duplica
    await page.getByRole("button", { name: "Refazer plano de hoje" }).click();
    await expect(page.getByText("Plano montado.")).toBeVisible({
      timeout: 15_000,
    });
    const { data: again } = await db
      .from("study_blocks")
      .select("planned_minutes");
    expect((again ?? []).reduce((a, b) => a + b.planned_minutes, 0)).toBe(60);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    // Foco e pausa (F4-T17): o tempo volta certo depois de recarregar; concluir registra.
    await page
      .getByRole("button", { name: "Começar foco", exact: true })
      .click();
    const focus = page.getByRole("dialog");
    await expect(focus.getByRole("button", { name: "Pausar" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      focus.getByText(/não bloqueia outros aplicativos/),
    ).toBeVisible();
    await page.waitForTimeout(2500);
    await focus.getByRole("button", { name: "Pausar" }).click();
    await expect(focus.getByRole("button", { name: "Retomar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Continuar foco", exact: true })
      .click();
    const back = page.getByRole("dialog");
    await expect(back.getByText(/Tempo ativo 00:0[2-9]/)).toBeVisible({
      timeout: 15_000,
    });
    await back.getByRole("button", { name: "Concluir bloco" }).click();
    await expect(page.getByRole("heading", { name: "Feito hoje" })).toBeVisible(
      { timeout: 15_000 },
    );
    const { data: done } = await db
      .from("study_blocks")
      .select("status, actual_minutes")
      .eq("status", "concluido");
    expect(done?.length).toBe(1);
  } finally {
    await wipe();
  }
});

test("sequência e folga: regra explicada, folga de amanhã marcada e desmarcada", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/rotina");
  const card = page.getByRole("region", { name: /^Sequência: \d+ dias?$/ });
  await expect(card).toBeVisible();
  await expect(
    card.getByText(
      /Folga\s+planejada, marcada para hoje ou para frente, não quebra a sequência/,
    ),
  ).toBeVisible();
  await expect(
    card.getByRole("list", { name: "Últimos 14 dias" }).getByRole("listitem"),
  ).toHaveCount(14);
  const mark = card.getByRole("button", { name: "Marcar folga amanhã" });
  if (await mark.isVisible()) {
    await mark.click();
    const status = card.getByText(
      /Folga de amanhã marcada\.|Até 2 folgas por semana/,
    );
    await expect(status).toBeVisible({ timeout: 15_000 });
    if ((await status.innerText()).startsWith("Folga")) {
      await card.getByRole("button", { name: "Desmarcar" }).last().click();
      await expect(card.getByText("Folga desmarcada.")).toBeVisible({
        timeout: 15_000,
      });
    }
  }
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
