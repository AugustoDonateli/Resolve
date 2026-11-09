/**
 * DADOS DEMONSTRATIVOS — protótipo de rotina (F1-T07).
 * A agenda é gerada a partir do horário atual para que o relógio, o foco e o
 * histórico usem tempos reais. Nenhum destes blocos vem de uso real.
 */

export type BlockKind = "revisao" | "treino" | "redacao" | "foco" | "compromisso";

export interface StudyBlock {
  id: string;
  kind: BlockKind;
  title: string;
  detail: string;
  /** Motivo explicável da recomendação (plano §7, prioridade didática). */
  reason?: string;
  /** Minutos desde 00:00 do dia local. */
  start: number;
  minutes: number;
  fixed?: boolean;
}

export interface DoneEntry {
  id: string;
  kind: BlockKind;
  title: string;
  startedAt: number; // epoch ms
  endedAt: number;
  plannedMinutes: number;
  activeMs: number;
}

export const KIND_LABEL: Record<BlockKind, string> = {
  revisao: "Revisão",
  treino: "Treino",
  redacao: "Redação",
  foco: "Foco",
  compromisso: "Compromisso fixo",
};

export const SLOT = 15;

export function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function demoDay(now = new Date()): { blocks: StudyBlock[]; gridStart: number; gridEnd: number; done: DoneEntry[] } {
  const base = Math.ceil((minutesNow(now) + 5) / SLOT) * SLOT;
  const blocks: StudyBlock[] = [
    {
      id: "b1",
      kind: "revisao",
      title: "Revisão vencida",
      detail: "6 cartões · Natureza e Matemática",
      reason: "Seis revisões venceram hoje e cabem em 25 minutos.",
      start: base,
      minutes: 25,
    },
    {
      id: "b2",
      kind: "treino",
      title: "Comando primeiro",
      detail: "Linguagens · 4 questões",
      reason: "Treino curto escolhido por você na meta da semana.",
      start: base + 30,
      minutes: 15,
    },
    {
      id: "fx",
      kind: "compromisso",
      title: "Aula de inglês",
      detail: "Compromisso fixo",
      start: base + 60,
      minutes: 60,
      fixed: true,
    },
    {
      id: "b3",
      kind: "redacao",
      title: "Introdução",
      detail: "Treino por peça · eixo Meio ambiente",
      reason: "Meta semanal de redação: 2 de 3 peças feitas.",
      start: base + 135,
      minutes: 30,
    },
    {
      id: "b4",
      kind: "foco",
      title: "Funções do 1º grau",
      detail: "Matemática · bloco de foco",
      reason: "Habilidade com evidência suficiente e acerto recente baixo.",
      start: base + 180,
      minutes: 50,
    },
  ];
  const t = now.getTime();
  const done: DoneEntry[] = [
    {
      id: "d0",
      kind: "revisao",
      title: "Revisão da manhã",
      startedAt: t - 6 * 3600_000,
      endedAt: t - 6 * 3600_000 + 18 * 60_000,
      plannedMinutes: 20,
      activeMs: 18 * 60_000,
    },
  ];
  return { blocks, gridStart: base - 60, gridEnd: base + 270, done };
}

/** Regra única de remarcação: usada pelo gesto e pelo formulário (F1-T07, F4-T16). */
export function canPlace(blocks: StudyBlock[], id: string, start: number, gridStart: number, gridEnd: number): { ok: true } | { ok: false; reason: string } {
  const b = blocks.find((x) => x.id === id);
  if (!b) return { ok: false, reason: "Bloco não encontrado." };
  if (b.fixed) return { ok: false, reason: "Compromissos fixos não são remarcados por aqui." };
  if (start < gridStart || start + b.minutes > gridEnd) return { ok: false, reason: "Esse horário fica fora do dia planejado." };
  const hit = blocks.find((o) => o.id !== id && start < o.start + o.minutes && o.start < start + b.minutes);
  if (hit) return { ok: false, reason: `Esse horário colide com “${hit.title}” (${fmtClock(hit.start)}).` };
  return { ok: true };
}

export function freeSlots(blocks: StudyBlock[], id: string, gridStart: number, gridEnd: number): number[] {
  const out: number[] = [];
  for (let s = gridStart; s <= gridEnd; s += SLOT) if (canPlace(blocks, id, s, gridStart, gridEnd).ok) out.push(s);
  return out;
}
