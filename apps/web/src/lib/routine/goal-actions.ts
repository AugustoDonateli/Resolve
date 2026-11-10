"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { textProblem } from "@/lib/editor/payload";
import { createClient } from "@/lib/supabase/server";

/** Metas e planos se-então (F4-T14). As políticas do banco restringem às linhas da própria conta. */
export type GoalResult = { ok: true } | { ok: false; message: string };

const uuid = z.string().uuid();

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function done(error: { message: string } | null): GoalResult {
  if (error) {
    if (/goals_one_active/.test(error.message))
      return {
        ok: false,
        message: "Já há uma meta ativa desse tipo. Arquive a atual antes.",
      };
    if (/check constraint/.test(error.message))
      return { ok: false, message: "Confira os valores da meta." };
    return { ok: false, message: "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return { ok: true };
}

const goalSchema = z
  .object({
    id: uuid.optional(),
    level: z.enum(["diaria", "semanal", "area"]),
    area: z.enum(["LC", "MT", "CN", "CH", "RED"]).optional(),
    minutes: z.coerce.number().int().min(5).max(10080).optional(),
    score: z.coerce.number().min(0).max(1000).optional(),
  })
  .refine(
    (g) => g.level === "area" || g.minutes !== undefined,
    "Informe os minutos da meta.",
  )
  .refine(
    (g) => g.level !== "diaria" || (g.minutes ?? 0) <= 1440,
    "Uma meta diária vai até 1440 minutos.",
  )
  .refine((g) => g.level !== "area" || g.area !== undefined, "Escolha a área.")
  .refine(
    (g) =>
      g.level !== "area" || g.score !== undefined || g.minutes !== undefined,
    "Informe a nota-alvo ou os minutos por semana.",
  );

/** Cria ou edita uma meta (diária, semanal ou por área). */
export async function saveGoal(input: unknown): Promise<GoalResult> {
  const p = goalSchema.safeParse(input);
  if (!p.success)
    return {
      ok: false,
      message: p.error.issues[0]?.message ?? "Dados inválidos.",
    };
  const g = p.data;
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para definir metas." };
  const row = {
    level: g.level,
    area_code: g.level === "area" ? g.area : null,
    target_minutes: g.minutes ?? null,
    target_score: g.level === "area" ? (g.score ?? null) : null,
  };
  const { error } = g.id
    ? await supabase.from("goals").update(row).eq("id", g.id)
    : await supabase.from("goals").insert(row);
  return done(error);
}

const planSchema = z.object({
  id: uuid.optional(),
  trigger: z.string().trim().min(3, "Descreva a situação (Se…).").max(200),
  activity: z
    .string()
    .trim()
    .min(3, "Descreva a alternativa (então…).")
    .max(200),
  minutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60, "A alternativa é curta: até 60 minutos."),
});

/** Cria ou edita um plano se-então (alternativa curta para dias difíceis). */
export async function savePlan(input: unknown): Promise<GoalResult> {
  const p = planSchema.safeParse(input);
  if (!p.success)
    return {
      ok: false,
      message: p.error.issues[0]?.message ?? "Dados inválidos.",
    };
  const d = p.data;
  for (const t of [d.trigger, d.activity]) {
    const problem = textProblem(t);
    if (problem) return { ok: false, message: problem };
  }
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para definir planos." };
  const row = {
    trigger_text: d.trigger,
    alternative_activity: d.activity,
    duration_minutes: d.minutes,
  };
  const { error } = d.id
    ? await supabase.from("if_then_plans").update(row).eq("id", d.id)
    : await supabase.from("if_then_plans").insert(row);
  return done(error);
}

/** Arquiva ou restaura uma meta ou um plano. Nada é apagado. */
export async function setArchived(input: unknown): Promise<GoalResult> {
  const p = z
    .object({
      table: z.enum(["goals", "if_then_plans"]),
      id: uuid,
      archived: z.boolean(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Dados inválidos." };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, message: "Entre para continuar." };
  const { error, data } = await supabase
    .from(p.data.table)
    .update({ archived_at: p.data.archived ? new Date().toISOString() : null })
    .eq("id", p.data.id)
    .select("id");
  if (!error && !data?.length) return { ok: false, message: "Não encontrado." };
  return done(error);
}
