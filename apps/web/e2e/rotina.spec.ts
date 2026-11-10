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
