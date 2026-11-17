/** Placar da semana do grupo (regra `tempo-v1`, no banco): tipos e contas puras para a tela. */

export interface WeekMember {
  nickname: string;
  me: boolean;
  /** Aparece no ranking; quem não aparece só tem o apelido exposto. */
  sharing: boolean;
  minutes: number | null;
  previousMinutes: number | null;
  questions: number | null;
  daysActive: number | null;
  studyingNow: boolean | null;
}

export interface WeekBoard {
  weekStart: string;
  goalMinutes: number | null;
  totalMinutes: number;
  members: WeekMember[];
}

/** 0 → "0 min"; 45 → "45 min"; 200 → "3 h 20 min"; 120 → "2 h". */
export function fmtStudy(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Comparação com a própria semana anterior; null quando não há base (as duas semanas zeradas). */
export function evolution(now: number | null, before: number | null): string | null {
  if (now === null || before === null || (now === 0 && before === 0)) return null;
  const d = now - before;
  if (d === 0) return "igual à semana passada";
  return `${fmtStudy(Math.abs(d))} ${d > 0 ? "a mais" : "a menos"} que na semana passada`;
}

/** Quem participa, em ordem de tempo (empate: mais dias com estudo, depois apelido). */
export function ranking(members: WeekMember[]): WeekMember[] {
  return members
    .filter((m) => m.sharing)
    .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0) || (b.daysActive ?? 0) - (a.daysActive ?? 0) || a.nickname.localeCompare(b.nickname, "pt-BR"));
}

/** Fração da meta coletiva (0 a 1); null sem meta. */
export function goalProgress(total: number, goal: number | null): number | null {
  return goal && goal > 0 ? Math.min(1, total / goal) : null;
}

/** "2026-11-16" → "16/11 a 22/11". */
export function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(d.getTime() + 6 * 86_400_000);
  const f = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${f(d)} a ${f(end)}`;
}
