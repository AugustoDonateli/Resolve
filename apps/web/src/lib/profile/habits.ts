/**
 * Hábitos de estudo (`habitos-v1`, regra da plataforma): tempo típico por questão, relação entre tempo e erro,
 * período do dia em que a conta mais acerta e as últimas semanas. Só afirma com respostas suficientes.
 */

export interface AreaPace {
  area: string;
  n: number;
  medianMs: number | null;
  nCorrect: number;
  medianMsCorrect: number | null;
  nWrong: number;
  medianMsWrong: number | null;
}

export interface PeriodTally {
  period: "madrugada" | "manha" | "tarde" | "noite";
  n: number;
  correct: number;
}

export interface WeekRow {
  weekStart: string;
  minutes: number;
  answers: number;
  correct: number;
  daysActive: number;
}

export const HABITS_RULE = { id: "habitos-v1", minTimed: 8, minSide: 5, minPeriod: 15, periodGap: 0.08 } as const;

/** 130000 → "2 min 10 s"; 45000 → "45 s"; 180000 → "3 min". */
export function fmtPace(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** O que o tempo nas certas e nas erradas sugere; null sem base ou sem diferença que valha comentar. */
export function paceInsight(p: Pick<AreaPace, "nCorrect" | "nWrong" | "medianMsCorrect" | "medianMsWrong">): string | null {
  if (p.nCorrect < HABITS_RULE.minSide || p.nWrong < HABITS_RULE.minSide || !p.medianMsCorrect || !p.medianMsWrong) return null;
  const ratio = p.medianMsWrong / p.medianMsCorrect;
  if (ratio >= 1.3) return "Você demora mais nas que erra. Questão que passa do seu tempo típico é candidata a ficar para depois.";
  if (ratio <= 0.7) return "Você erra rápido. Antes de marcar, vale reler o comando.";
  return null;
}

/** Alvo sugerido para os blocos de ritmo: o tempo típico arredondado para cima, entre 1 e 6 minutos. */
export function suggestedTarget(overallMedianMs: number | null, timed: number): number | null {
  if (!overallMedianMs || timed < HABITS_RULE.minTimed) return null;
  return Math.min(6, Math.max(1, Math.ceil(overallMedianMs / 60_000)));
}

const PERIOD_NAME: Record<PeriodTally["period"], string> = { madrugada: "de madrugada", manha: "de manhã", tarde: "à tarde", noite: "à noite" };

/** Em que período do dia a conta mais acerta; frase honesta quando não há base ou a diferença é pequena. */
export function bestPeriod(periods: PeriodTally[]): { text: string; best: PeriodTally["period"] | null } {
  const rated = periods.filter((p) => p.n >= HABITS_RULE.minPeriod).sort((a, b) => b.correct / b.n - a.correct / a.n);
  if (rated.length < 2)
    return { text: `Ainda não dá para comparar: é preciso ter ${HABITS_RULE.minPeriod} respostas em pelo menos dois períodos do dia.`, best: null };
  const top = rated[0]!;
  const low = rated.at(-1)!;
  const pct = (p: PeriodTally) => `${Math.round((p.correct / p.n) * 100)}%`;
  if (top.correct / top.n - low.correct / low.n < HABITS_RULE.periodGap)
    return { text: "Sem diferença clara entre os períodos do dia: seu acerto é parecido em todos.", best: null };
  return { text: `Você acerta mais ${PERIOD_NAME[top.period]} (${pct(top)}) do que ${PERIOD_NAME[low.period]} (${pct(low)}).`, best: top.period };
}

/** Semanas da mais recente para a mais antiga, parando antes do trecho inicial sem nenhum estudo. */
export function weeksWithHistory(weeks: WeekRow[]): WeekRow[] {
  const lastActive = weeks.findLastIndex((w) => w.answers > 0 || w.minutes > 0);
  return lastActive < 0 ? [] : weeks.slice(0, lastActive + 1);
}

/** Comparação da semana atual com a anterior, em frase; null sem semana anterior com estudo. */
export function weekTrend(weeks: WeekRow[]): string | null {
  const [now, before] = weeks;
  if (!now || !before || before.answers === 0) return null;
  const d = now.answers - before.answers;
  if (d === 0) return "Mesmo número de respostas da semana passada.";
  return `${Math.abs(d)} ${Math.abs(d) === 1 ? "resposta" : "respostas"} ${d > 0 ? "a mais" : "a menos"} que na semana passada (a semana ainda pode estar em curso).`;
}
