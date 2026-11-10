/**
 * Agenda automática básica (F4-T15): distribui tarefas nos horários livres do dia, sem tocar em
 * compromissos, respeitando duração mínima/máxima de bloco e intervalo entre blocos. Tudo que não
 * cabe volta com o motivo — nada é cortado em silêncio.
 * Horários em minutos desde 00:00 do dia local.
 */
export interface Window {
  start: number;
  end: number;
}

export interface PlanTask {
  id: string;
  kind: "revisao" | "treino" | "redacao";
  title: string;
  /** Minutos desejados no dia. */
  minutes: number;
  /** Menor bloco útil para esta tarefa. */
  minBlock: number;
  /** Maior bloco contínuo (foco de 25–50 min, F4-T17). */
  maxBlock: number;
  /** Menor número = mais importante. */
  priority: number;
  reason: string;
}

export interface PlannedBlock {
  taskId: string;
  kind: PlanTask["kind"];
  title: string;
  start: number;
  minutes: number;
  reason: string;
}

export interface LeftOut {
  taskId: string;
  title: string;
  minutes: number;
  why: string;
}

export interface PlanOptions {
  /** Intervalo entre blocos seguidos. */
  gap: number;
  /** Não planeja antes deste minuto (ex.: agora, arredondado). */
  notBefore: number;
  /** Granularidade dos horários de início. */
  step: number;
}

/** Horários livres menos compromissos (e menos o que já passou). Resultado ordenado e sem sobreposição. */
export function freeWindows(
  available: Window[],
  busy: Window[],
  notBefore = 0,
): Window[] {
  const merged = mergeWindows(
    available
      .map((w) => ({ start: Math.max(w.start, notBefore), end: w.end }))
      .filter((w) => w.end > w.start),
  );
  const blocks = mergeWindows(busy);
  const out: Window[] = [];
  for (const w of merged) {
    let cur = w.start;
    for (const b of blocks) {
      if (b.end <= cur || b.start >= w.end) continue;
      if (b.start > cur) out.push({ start: cur, end: b.start });
      cur = Math.max(cur, b.end);
    }
    if (cur < w.end) out.push({ start: cur, end: w.end });
  }
  return out;
}

export function mergeWindows(ws: Window[]): Window[] {
  const sorted = [...ws]
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

const ceilTo = (v: number, step: number) => Math.ceil(v / step) * step;

/**
 * Preenche as janelas por prioridade: cada tarefa ocupa blocos de até `maxBlock`, nunca menores que
 * `minBlock`, com `gap` entre blocos seguidos. O que sobrar de cada tarefa vira `LeftOut`.
 */
export function planDay(
  windows: Window[],
  tasks: PlanTask[],
  opts: PlanOptions,
): { blocks: PlannedBlock[]; leftOut: LeftOut[] } {
  const free = freeWindows(windows, [], opts.notBefore).map((w) => ({
    start: ceilTo(w.start, opts.step),
    end: w.end,
  }));
  const blocks: PlannedBlock[] = [];
  const leftOut: LeftOut[] = [];
  const totalFree = free.reduce((a, w) => a + Math.max(0, w.end - w.start), 0);
  for (const t of [...tasks].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )) {
    let remaining = t.minutes;
    for (const w of free) {
      while (remaining >= t.minBlock && w.end - w.start >= t.minBlock) {
        const len = Math.min(t.maxBlock, remaining, w.end - w.start);
        if (len < t.minBlock) break;
        blocks.push({
          taskId: t.id,
          kind: t.kind,
          title: t.title,
          start: w.start,
          minutes: len,
          reason: t.reason,
        });
        remaining -= len;
        w.start = ceilTo(w.start + len + opts.gap, opts.step);
      }
      if (remaining < t.minBlock) break;
    }
    if (remaining > 0) {
      const why =
        totalFree === 0
          ? "Não há horário livre hoje."
          : remaining < t.minBlock
            ? `Sobra de ${remaining} min, menor que o bloco mínimo de ${t.minBlock} min.`
            : "Não coube nos horários livres que restaram depois das tarefas mais importantes.";
      leftOut.push({ taskId: t.id, title: t.title, minutes: remaining, why });
    }
  }
  blocks.sort((a, b) => a.start - b.start);
  return { blocks, leftOut };
}

export const AREA_NAME: Record<string, string> = {
  LC: "Linguagens",
  MT: "Matemática",
  CN: "Ciências da Natureza",
  CH: "Ciências Humanas",
  RED: "Redação",
};

export interface PlanInputs {
  /** Minutos das revisões vencidas no lote de hoje (fila do banco). */
  reviewMinutes: number;
  reviewCount: number;
  dailyGoal: number | null;
  weeklyGoal: number | null;
  areaGoals: { area: string; weeklyMinutes: number }[];
}

const round5 = (v: number) => Math.round(v / 5) * 5;

/**
 * Tarefas do dia a partir da fila de revisão e das metas (F4-T14): revisão vencida primeiro; depois
 * o tempo semanal de cada área (÷ 7); o que faltar para a meta diária (ou semanal ÷ 7) vira treino livre.
 * Sem meta, só a revisão entra, e a nota diz por quê.
 */
export function buildTasks(i: PlanInputs): {
  tasks: PlanTask[];
  notes: string[];
} {
  const tasks: PlanTask[] = [];
  const notes: string[] = [];
  if (i.reviewMinutes > 0) {
    tasks.push({
      id: "revisao",
      kind: "revisao",
      title: "Revisão do dia",
      minutes: i.reviewMinutes,
      minBlock: Math.min(10, i.reviewMinutes),
      maxBlock: 50,
      priority: 1,
      reason: `${i.reviewCount} ${i.reviewCount === 1 ? "revisão venceu" : "revisões venceram"} e ${i.reviewCount === 1 ? "cabe" : "cabem"} no tempo escolhido.`,
    });
  }
  const daily = i.dailyGoal ?? (i.weeklyGoal ? round5(i.weeklyGoal / 7) : null);
  let areaTotal = 0;
  for (const g of i.areaGoals) {
    const m = round5(g.weeklyMinutes / 7);
    if (m < 15) continue;
    areaTotal += m;
    tasks.push({
      id: `area-${g.area}`,
      kind: g.area === "RED" ? "redacao" : "treino",
      title:
        g.area === "RED"
          ? "Redação"
          : `Treino de ${AREA_NAME[g.area] ?? g.area}`,
      minutes: m,
      minBlock: 15,
      maxBlock: 50,
      priority: 2,
      reason: `Meta de ${g.weeklyMinutes} min por semana em ${AREA_NAME[g.area] ?? g.area} (≈ ${m} min por dia).`,
    });
  }
  if (daily === null) {
    notes.push(
      "Sem meta diária ou semanal: o plano reserva só a revisão e as metas por área. Defina uma meta em “Metas” para incluir treino.",
    );
  } else {
    const rest = daily - i.reviewMinutes - areaTotal;
    if (rest >= 15) {
      tasks.push({
        id: "treino-livre",
        kind: "treino",
        title: "Treino livre",
        minutes: rest,
        minBlock: 15,
        maxBlock: 50,
        priority: 3,
        reason: `Completa a meta de ${daily} min ${i.dailyGoal ? "por dia" : "(semanal ÷ 7)"}.`,
      });
    }
  }
  return { tasks, notes };
}
