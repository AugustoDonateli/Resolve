"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { textProblem } from "@/lib/editor/payload";
import { createClient } from "@/lib/supabase/server";
import { scheduleError, timeRangeProblem } from "./schedule-types";

/**
 * Ações da rotina (F4-T13). A conta vem do login e as políticas do banco restringem às próprias linhas;
 * conflitos, fuso e validade da exceção são conferidos no banco (a mensagem de conflito vem de lá).
 */
export type ScheduleResult = { ok: true } | { ok: false; message: string };

const uuid = z.string().uuid();
const time = z.string().regex(/^\d{2}:\d{2}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const table = {
  disponivel: "availability_rules",
  compromisso: "fixed_commitments",
} as const;

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function done(
  error: { message: string; hint?: string | null } | null,
): ScheduleResult {
  if (error)
    return { ok: false, message: scheduleError(error.message, error.hint) };
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return { ok: true };
}

const ruleSchema = z.object({
  kind: z.enum(["disponivel", "compromisso"]),
  title: z.string().trim().max(80).default(""),
  weekday: z.coerce.number().int().min(0).max(6),
  start: time,
  end: time,
});

/** Cria um horário livre ou um compromisso que se repete toda semana. */
export async function addWeeklyRule(input: unknown): Promise<ScheduleResult> {
  const p = ruleSchema.safeParse(input);
  if (!p.success)
    return { ok: false, message: "Escolha o dia e informe início e fim." };
  const d = p.data;
  const range = timeRangeProblem(d.start, d.end);
  if (range) return { ok: false, message: range };
  if (d.kind === "compromisso") {
    if (!d.title) return { ok: false, message: "Dê um nome ao compromisso." };
    const problem = textProblem(d.title);
    if (problem) return { ok: false, message: problem };
  }
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para planejar a semana." };
  const row = {
    weekday: d.weekday,
    start_time: d.start,
    end_time: d.end,
    ...(d.kind === "compromisso" ? { title: d.title } : {}),
  };
  const { error } = await supabase.from(table[d.kind]).insert(row);
  return done(error);
}

/** Remove uma regra semanal inteira (e as mudanças de um dia ligadas a ela). */
export async function removeWeeklyRule(
  input: unknown,
): Promise<ScheduleResult> {
  const p = z
    .object({ kind: z.enum(["disponivel", "compromisso"]), id: uuid })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Horário inválido." };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para planejar a semana." };
  const { error, data } = await supabase
    .from(table[p.data.kind])
    .delete()
    .eq("id", p.data.id)
    .select("id");
  if (!error && !data?.length)
    return { ok: false, message: "Horário não encontrado." };
  return done(error);
}

const oneDaySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancelar"),
    kind: z.enum(["disponivel", "compromisso"]),
    ruleId: uuid,
    date,
  }),
  z.object({
    action: z.literal("mover"),
    kind: z.enum(["disponivel", "compromisso"]),
    ruleId: uuid,
    date,
    start: time,
    end: time,
  }),
]);

/** Cancela ou muda o horário de um único dia. A regra semanal não é alterada. */
export async function changeOneDay(input: unknown): Promise<ScheduleResult> {
  const p = oneDaySchema.safeParse(input);
  if (!p.success)
    return { ok: false, message: "Informe o dia e o novo horário." };
  const d = p.data;
  if (d.action === "mover") {
    const range = timeRangeProblem(d.start, d.end);
    if (range) return { ok: false, message: range };
  }
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para planejar a semana." };
  const { error } = await supabase.from("schedule_exceptions").insert({
    kind: d.kind,
    action: d.action,
    on_date: d.date,
    ...(d.kind === "disponivel"
      ? { availability_rule_id: d.ruleId }
      : { commitment_id: d.ruleId }),
    ...(d.action === "mover" ? { start_time: d.start, end_time: d.end } : {}),
  });
  return done(error);
}

/** Desfaz a mudança de um dia: a ocorrência da regra volta (o banco recusa se ela colidir). */
export async function undoOneDay(input: unknown): Promise<ScheduleResult> {
  const p = z.object({ id: uuid }).safeParse(input);
  if (!p.success) return { ok: false, message: "Mudança inválida." };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para planejar a semana." };
  const { error, data } = await supabase
    .from("schedule_exceptions")
    .delete()
    .eq("id", p.data.id)
    .select("id");
  if (!error && !data?.length)
    return { ok: false, message: "Mudança não encontrada." };
  return done(error);
}
