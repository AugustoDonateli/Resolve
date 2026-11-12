/**
 * Agenda automática básica (F4-T15): distribui tarefas nos horários livres do dia, sem tocar em
 * compromissos, respeitando duração mínima/máxima de bloco e intervalo entre blocos. Tudo que não
 * cabe volta com o motivo — nada é cortado em silêncio.
 * Horários em minutos desde 00:00 do dia local.
 */
import { FINAL_STRETCH_DAYS } from "./exam";

/** Título dos blocos de ritmo da reta final (a tela usa para levar ao bloco de ritmo). */
export const RHYTHM_TITLE = "Bloco de ritmo";

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
  /** Área escolhida pelo plano adaptativo para o treino livre (null = sem histórico). */
  focus?: TrainingFocus | null;
  /** Dias até o 1º dia (data informada pela conta); dentro da reta final o treino livre vira ritmo. */
  daysToExam?: number | null;
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
    // Um bloco de estudo tem no mínimo 5 min (regra do banco): uma revisão curta ocupa esse mínimo.
    const reviewMinutes = Math.max(5, i.reviewMinutes);
    tasks.push({
      id: "revisao",
      kind: "revisao",
      title: "Revisão do dia",
      minutes: reviewMinutes,
      minBlock: Math.min(10, reviewMinutes),
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
      const goal = `Completa a meta de ${daily} min ${i.dailyGoal ? "por dia" : "(semanal ÷ 7)"}.`;
      const final = i.daysToExam != null && i.daysToExam >= 0 && i.daysToExam <= FINAL_STRETCH_DAYS;
      tasks.push(
        final
          ? {
              id: "ritmo",
              kind: "treino",
              title: RHYTHM_TITLE,
              minutes: rest,
              minBlock: 15,
              maxBlock: 50,
              priority: 3,
              reason: `${goal} Reta final (faltam ${i.daysToExam} ${i.daysToExam === 1 ? "dia" : "dias"}, data informada por você): questões contra o relógio, gabarito no fim.`,
            }
          : i.focus
          ? {
              id: `foco-${i.focus.area}`,
              kind: "treino",
              title: `Treino de ${AREA_NAME[i.focus.area]}`,
              minutes: rest,
              minBlock: 15,
              maxBlock: 50,
              priority: 3,
              reason: `${goal} Área escolhida: ${i.focus.reason}`,
            }
          : {
              id: "treino-livre",
              kind: "treino",
              title: "Treino livre",
              minutes: rest,
              minBlock: 15,
              maxBlock: 50,
              priority: 3,
              reason: goal,
            },
      );
    }
  }
  return { tasks, notes };
}

/** Desempenho recente de uma área (respostas de primeira tentativa nos últimos 14 dias). */
export interface AreaStat {
  area: "LC" | "CH" | "CN" | "MT";
  answers: number;
  wrong: number;
  /** Dias desde a última resposta na área; null = nunca respondeu. */
  daysSinceLast: number | null;
}

export interface TrainingFocus {
  area: AreaStat["area"];
  reason: string;
}

/** Regra da plataforma (não é regra do Inep): mínimo de respostas para comparar taxas de erro. */
export const ADAPTIVE_RULE = { id: "adaptativo-v1", minAnswers: 10, windowDays: 14 } as const;

/**
 * Plano adaptativo (adaptativo-v1): escolhe a área do treino livre. Entre as áreas com pelo menos
 * `minAnswers` respostas na janela, vai para a de maior taxa de erro (empate: a que está há mais tempo
 * sem treino). Se nenhuma tem respostas suficientes, vai para a área há mais tempo sem treino, desde
 * que exista algum histórico; sem histórico nenhum, não escolhe (o treino continua livre).
 */
export function chooseTrainingFocus(stats: AreaStat[]): TrainingFocus | null {
  if (!stats.some((s) => s.answers > 0)) return null;
  const stale = (s: AreaStat) => s.daysSinceLast ?? Number.POSITIVE_INFINITY;
  const rated = stats.filter((s) => s.answers >= ADAPTIVE_RULE.minAnswers);
  if (rated.length) {
    const best = [...rated].sort(
      (a, b) => b.wrong / b.answers - a.wrong / a.answers || stale(b) - stale(a) || a.area.localeCompare(b.area),
    )[0]!;
    const pct = Math.round((best.wrong / best.answers) * 100);
    const others = rated.length > 1 ? " a maior taxa entre as áreas com respostas suficientes" : " a única área com respostas suficientes para comparar";
    return {
      area: best.area,
      reason: `${best.wrong} erros em ${best.answers} respostas nos últimos ${ADAPTIVE_RULE.windowDays} dias (${pct}%):${others}.`,
    };
  }
  const best = [...stats].sort((a, b) => stale(b) - stale(a) || a.area.localeCompare(b.area))[0]!;
  return {
    area: best.area,
    reason:
      best.daysSinceLast === null
        ? `Nenhuma resposta em ${AREA_NAME[best.area]} nos últimos ${ADAPTIVE_RULE.windowDays} dias; ainda não há respostas suficientes (${ADAPTIVE_RULE.minAnswers} por área) para comparar erros.`
        : `Área há mais tempo sem treino (${best.daysSinceLast} ${best.daysSinceLast === 1 ? "dia" : "dias"}); ainda não há respostas suficientes (${ADAPTIVE_RULE.minAnswers} por área) para comparar erros.`,
  };
}
