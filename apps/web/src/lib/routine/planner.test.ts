import { describe, expect, it } from "vitest";
import { buildTasks, freeWindows, planDay, type PlanTask } from "./planner";

const h = (hh: number, mm = 0) => hh * 60 + mm;
const task = (
  id: string,
  minutes: number,
  priority: number,
  over: Partial<PlanTask> = {},
): PlanTask => ({
  id,
  kind: "treino",
  title: id,
  minutes,
  minBlock: 15,
  maxBlock: 50,
  priority,
  reason: `motivo ${id}`,
  ...over,
});
const opts = { gap: 5, notBefore: 0, step: 5 };

describe("janelas livres", () => {
  it("tira compromissos e o que já passou, junta janelas sobrepostas", () => {
    expect(
      freeWindows(
        [
          { start: h(18), end: h(22) },
          { start: h(21), end: h(23) },
        ],
        [{ start: h(19), end: h(20) }],
        h(18, 30),
      ),
    ).toEqual([
      { start: h(18, 30), end: h(19) },
      { start: h(20), end: h(23) },
    ]);
  });
});

describe("agenda automática", () => {
  it("respeita prioridade, bloco máximo e intervalo; nada fora das janelas", () => {
    const windows = freeWindows(
      [{ start: h(18), end: h(22) }],
      [{ start: h(19), end: h(20) }],
    );
    const { blocks, leftOut } = planDay(
      windows,
      [task("revisao", 30, 1, { kind: "revisao" }), task("treino", 90, 2)],
      opts,
    );
    expect(blocks.map((b) => [b.taskId, b.start / 60, b.minutes])).toEqual([
      ["revisao", 18, 30],
      ["treino", 18 + 35 / 60, 25], // aproveita o espaço antes do compromisso
      ["treino", 20, 50],
      ["treino", 20 + 55 / 60, 15],
    ]);
    for (const b of blocks)
      expect(
        windows.some((w) => b.start >= w.start && b.start + b.minutes <= w.end),
      ).toBe(true);
    expect(leftOut).toEqual([]);
  });

  it("não cria bloco menor que o mínimo e explica o que ficou de fora", () => {
    const windows = [{ start: h(18), end: h(18, 40) }];
    const { blocks, leftOut } = planDay(
      windows,
      [task("a", 30, 1), task("b", 30, 2)],
      opts,
    );
    expect(blocks.map((b) => [b.taskId, b.minutes])).toEqual([["a", 30]]);
    expect(leftOut).toEqual([
      {
        taskId: "b",
        title: "b",
        minutes: 30,
        why: "Não coube nos horários livres que restaram depois das tarefas mais importantes.",
      },
    ]);
  });

  it("sem horário livre: tudo de fora com o motivo", () => {
    const { blocks, leftOut } = planDay([], [task("a", 20, 1)], opts);
    expect(blocks).toEqual([]);
    expect(leftOut[0]!.why).toBe("Não há horário livre hoje.");
  });

  it("sobra menor que o bloco mínimo é informada, não espremida", () => {
    const { blocks, leftOut } = planDay(
      [{ start: h(8), end: h(12) }],
      [task("a", 60, 1, { maxBlock: 50 })],
      opts,
    );
    expect(blocks.map((b) => b.minutes)).toEqual([50]);
    expect(leftOut[0]!.why).toMatch(/Sobra de 10 min/);
  });

  it("começa no horário arredondado a partir de agora", () => {
    const { blocks } = planDay(
      [{ start: h(8), end: h(12) }],
      [task("a", 20, 1)],
      { ...opts, notBefore: h(9, 2) },
    );
    expect(blocks[0]!.start).toBe(h(9, 5));
  });
});

describe("tarefas do dia", () => {
  it("revisão, metas por área e o restante da meta diária", () => {
    const { tasks, notes } = buildTasks({
      reviewMinutes: 15,
      reviewCount: 5,
      dailyGoal: 120,
      weeklyGoal: null,
      areaGoals: [
        { area: "MT", weeklyMinutes: 210 },
        { area: "LC", weeklyMinutes: 60 },
      ],
    });
    expect(tasks.map((t) => [t.id, t.minutes, t.priority])).toEqual([
      ["revisao", 15, 1],
      ["area-MT", 30, 2],
      ["treino-livre", 75, 3],
    ]);
    expect(notes).toEqual([]);
  });
  it("sem meta: só revisão, com nota", () => {
    const { tasks, notes } = buildTasks({
      reviewMinutes: 6,
      reviewCount: 2,
      dailyGoal: null,
      weeklyGoal: null,
      areaGoals: [],
    });
    expect(tasks.map((t) => [t.id, t.minBlock])).toEqual([["revisao", 6]]);
    expect(notes[0]).toMatch(/Sem meta/);
  });
  it("meta semanal vira diária (÷ 7)", () => {
    const { tasks } = buildTasks({
      reviewMinutes: 0,
      reviewCount: 0,
      dailyGoal: null,
      weeklyGoal: 420,
      areaGoals: [],
    });
    expect(tasks.map((t) => [t.id, t.minutes])).toEqual([["treino-livre", 60]]);
  });
});
