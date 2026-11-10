/**
 * Disponibilidade e compromissos (F4-T13): tipos e funções puras usadas pela tela e pelas ações.
 * A regra de conflito e a expansão das ocorrências ficam no banco; aqui só formatação e validação de forma.
 */

export type ScheduleKind = "disponivel" | "compromisso";

export interface WeeklyRule {
  id: string;
  kind: ScheduleKind;
  title: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  valid_from: string;
  valid_until: string | null;
}

export interface ScheduleException {
  id: string;
  kind: ScheduleKind;
  action: "cancelar" | "mover" | "avulso";
  rule_id: string | null;
  on_date: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  title: string | null;
}

export interface Occurrence {
  kind: ScheduleKind;
  source: "regra" | "excecao";
  source_id: string;
  rule_id: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  local_start: string;
  local_end: string;
  changed: boolean;
}

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;
export const WEEKDAYS_SHORT = [
  "dom.",
  "seg.",
  "ter.",
  "qua.",
  "qui.",
  "sex.",
  "sáb.",
] as const;

/** "19:00:00" ou "2026-11-16T19:00:00" → "19:00". */
export function hhmm(t: string): string {
  const m = t.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? `${m[1]}:${m[2]}` : t;
}

/** Data (AAAA-MM-DD) de um instante no fuso indicado. */
export function dateInZone(instant: Date | string, timeZone: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Soma dias a uma data AAAA-MM-DD, sem depender do fuso da máquina. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** "2026-11-16" → "seg., 16/11". */
export function dayLabel(date: string): string {
  return `${WEEKDAYS_SHORT[weekdayOf(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Intervalo local de uma ocorrência; marca quando termina em outro dia. */
export function occurrenceRange(
  o: Pick<Occurrence, "local_start" | "local_end">,
): string {
  const sameDay = o.local_start.slice(0, 10) === o.local_end.slice(0, 10);
  return `${hhmm(o.local_start)}–${hhmm(o.local_end)}${sameDay ? "" : " (dia seguinte)"}`;
}

/** Agrupa as ocorrências pela data local de início, mantendo os dias pedidos mesmo vazios. */
export function groupByDay(
  days: string[],
  occ: Occurrence[],
): Map<string, Occurrence[]> {
  const out = new Map<string, Occurrence[]>(days.map((d) => [d, []]));
  for (const o of occ) out.get(o.local_start.slice(0, 10))?.push(o);
  return out;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validação de forma de um intervalo no mesmo dia (o banco confere conflitos e fuso). */
export function timeRangeProblem(start: string, end: string): string | null {
  if (!TIME.test(start) || !TIME.test(end))
    return "Informe início e fim no formato 00:00.";
  if (end <= start)
    return "O fim precisa ser depois do início, no mesmo dia. Para virar a noite, crie dois horários.";
  return null;
}

/** Traduz os erros do banco para a tela. A dica do banco já descreve o conflito com data e horário. */
export function scheduleError(message: string, hint?: string | null): string {
  if (/resolve_schedule_conflict/.test(message))
    return hint || "Esse horário colide com outro.";
  if (/resolve_schedule_not_an_occurrence/.test(message))
    return "A regra não acontece nesse dia.";
  if (/schedule_exceptions_one_per_occurrence/.test(message))
    return "Esse dia já tem uma mudança. Desfaça antes de mudar de novo.";
  if (/resolve_schedule_date_out_of_range/.test(message))
    return "Mude datas de hoje até um ano à frente.";
  if (/resolve_schedule_rule_fixed/.test(message))
    return "Dia da semana e fuso não mudam: remova e crie outro horário.";
  if (/resolve_timezone_invalid/.test(message))
    return "Fuso horário desconhecido. Confira o fuso em Mais › Preferências.";
  if (/check constraint|violates check/.test(message))
    return "Confira os dados: o fim precisa ser depois do início e o título não pode ficar vazio.";
  return "Não foi possível salvar. Tente de novo.";
}
