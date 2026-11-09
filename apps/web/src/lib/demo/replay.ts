/**
 * SESSÃO DEMONSTRATIVA para o protótipo de replay (F1-T12).
 * Dez eventos inventados para testar a visualização; não vêm de uso real.
 * Não há acerto/erro nem "chute": nada foi declarado nesta sessão.
 */
import type { Letter } from "@/components/ui/alternatives";

export type ReplayEventType = "resposta" | "marcada" | "retorno" | "mudanca";

export interface ReplayEvent {
  id: string;
  /** Minutos desde o início da sessão. */
  t: number;
  q: number;
  type: ReplayEventType;
  letter?: Letter;
  from?: Letter;
}

export const SESSION_MINUTES = 45;

export const demoEvents: ReplayEvent[] = [
  { id: "e1", t: 2, q: 1, type: "resposta", letter: "C" },
  { id: "e2", t: 6, q: 2, type: "resposta", letter: "A" },
  { id: "e3", t: 9, q: 3, type: "marcada" },
  { id: "e4", t: 13, q: 4, type: "resposta", letter: "D" },
  { id: "e5", t: 18, q: 5, type: "resposta", letter: "B" },
  { id: "e6", t: 22, q: 6, type: "resposta", letter: "E" },
  { id: "e7", t: 27, q: 3, type: "retorno", letter: "B" },
  { id: "e8", t: 31, q: 7, type: "resposta", letter: "A" },
  { id: "e9", t: 36, q: 4, type: "mudanca", letter: "C", from: "D" },
  { id: "e10", t: 41, q: 8, type: "resposta", letter: "D" },
];

export const EVENT_LABEL: Record<ReplayEventType, string> = {
  resposta: "Resposta",
  marcada: "Marcada para voltar",
  retorno: "Voltou e respondeu",
  mudanca: "Mudou a resposta",
};

/** Resposta final de cada questão e o evento que a produziu (correspondência cartão ↔ linha). */
export function finalAnswers(events: ReplayEvent[]): Map<number, { letter: Letter; eventId: string }> {
  const m = new Map<number, { letter: Letter; eventId: string }>();
  for (const e of [...events].sort((a, b) => a.t - b.t)) if (e.letter) m.set(e.q, { letter: e.letter, eventId: e.id });
  return m;
}

/** Tempo entre um evento e o anterior (estimativa de permanência, não leitura de atenção). */
export function gapBefore(events: ReplayEvent[], id: string): number {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const i = sorted.findIndex((e) => e.id === id);
  if (i < 0) return 0;
  return sorted[i]!.t - (i === 0 ? 0 : sorted[i - 1]!.t);
}

/** Escala do resumo: 45 min de sessão em 15 s de reprodução → 1 s = 3 min. */
export const PLAYBACK_SECONDS = 15;
export const minutesPerSecond = SESSION_MINUTES / PLAYBACK_SECONDS;
