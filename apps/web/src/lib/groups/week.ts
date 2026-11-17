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
  /** Chave para aplaudir e desafiar; só vem de quem está no ranking. */
  userId: string | null;
  applause: number | null;
  applaudedByMe: boolean | null;
}

/** Duelo de tempo da semana entre duas pessoas do ranking. */
export interface TimeDuel {
  a: string;
  b: string;
  aMinutes: number;
  bMinutes: number;
  aMe: boolean;
  bMe: boolean;
}

export interface WeekRecap {
  weekStart: string;
  totalMinutes: number;
  members: { nickname: string; me: boolean; minutes: number; applause: number }[];
  timeDuels: TimeDuel[];
}

export interface WeekBoard {
  weekStart: string;
  goalMinutes: number | null;
  totalMinutes: number;
  members: WeekMember[];
  timeDuels: TimeDuel[];
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

const who = (name: string, me: boolean) => (me ? "Você" : name);

/** "Você 2 h × Ana 3 h: Ana está na frente." Com a semana fechada, diz quem venceu. */
export function duelLine(d: TimeDuel, closed: boolean): string {
  const a = who(d.a, d.aMe);
  const b = who(d.b, d.bMe);
  const score = `${a} ${fmtStudy(d.aMinutes)} × ${b} ${fmtStudy(d.bMinutes)}`;
  if (d.aMinutes === d.bMinutes) return `${score}: ${closed ? "empate" : "empatados"}.`;
  const ahead = d.aMinutes > d.bMinutes ? a : b;
  const verb = ahead === "Você" ? (closed ? "você venceu" : "você está na frente") : closed ? `${ahead} venceu` : `${ahead} está na frente`;
  return `${score}: ${verb}.`;
}

/** Frases do resumo da semana passada; lista vazia quando ninguém do ranking estudou (não há o que resumir). */
export function recapLines(r: WeekRecap): string[] {
  if (r.totalMinutes === 0 || r.members.length === 0) return [];
  const sorted = [...r.members].sort((a, b) => b.minutes - a.minutes || a.nickname.localeCompare(b.nickname, "pt-BR"));
  const first = sorted[0]!;
  const out = [`${first.me ? "Você ficou" : `${first.nickname} ficou`} em 1º, com ${fmtStudy(first.minutes)}. O grupo somou ${fmtStudy(r.totalMinutes)}.`];
  const mine = sorted.findIndex((m) => m.me);
  if (mine > 0) out.push(`Você ficou em ${mine + 1}º, com ${fmtStudy(sorted[mine]!.minutes)}.`);
  const clapped = sorted.filter((m) => m.applause > 0).sort((a, b) => b.applause - a.applause)[0];
  if (clapped) out.push(`${clapped.me ? "Você recebeu" : `${clapped.nickname} recebeu`} ${clapped.applause} ${clapped.applause === 1 ? "aplauso" : "aplausos"}.`);
  for (const d of r.timeDuels) out.push(`Duelo de tempo: ${duelLine(d, true)}`);
  return out;
}
