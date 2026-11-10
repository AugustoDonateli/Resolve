"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type StreakResult = { ok: true } | { ok: false; message: string };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MSG: [RegExp, string][] = [
  [/rest_day_past/, "Folga é planejada: só para hoje ou para frente."],
  [/rest_day_limit/, "Até 2 folgas por semana (segunda a domingo)."],
  [/rest_day_far/, "Planeje folgas até dois meses à frente."],
  [
    /rest_day_history|row-level|permission/,
    "Folga de hoje ou de dias passados fica no histórico.",
  ],
  [/duplicate key/, "Esse dia já está marcado como folga."],
];
const explain = (m: string) =>
  MSG.find(([re]) => re.test(m))?.[1] ??
  "Não foi possível salvar. Tente de novo.";

/** Marca folga planejada (F4-T18): hoje ou para frente, até 2 por semana — o banco confere. */
export async function markRest(input: unknown): Promise<StreakResult> {
  const p = z.object({ date }).safeParse(input);
  if (!p.success) return { ok: false, message: "Data inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rest_days")
    .insert({ rest_date: p.data.date });
  if (error) return { ok: false, message: explain(error.message) };
  revalidatePath("/rotina");
  return { ok: true };
}

/** Desmarca folga futura. Folga de hoje ou passada fica no histórico (o banco recusa). */
export async function unmarkRest(input: unknown): Promise<StreakResult> {
  const p = z.object({ date }).safeParse(input);
  if (!p.success) return { ok: false, message: "Data inválida." };
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("rest_days")
    .delete()
    .eq("rest_date", p.data.date)
    .select("rest_date");
  if (error) return { ok: false, message: explain(error.message) };
  if (!data?.length) return { ok: false, message: "Folga não encontrada." };
  revalidatePath("/rotina");
  return { ok: true };
}
