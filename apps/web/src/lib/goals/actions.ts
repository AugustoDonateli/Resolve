"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };
const weight = z.number().min(0.1).max(10).optional();

const schema = z
  .object({
    course: z.string().trim().min(2).max(120),
    institution: z.string().trim().min(2).max(160),
    modality: z.string().trim().max(120).nullable(),
    cutoff: z.number().min(0).max(1000).nullable(),
    weights: z.object({ LC: weight, CH: weight, CN: weight, MT: weight, RED: weight }).nullable(),
    source: z.string().trim().max(500).nullable(),
  })
  .refine((v) => (v.cutoff === null && v.weights === null) || (v.source ?? "").length >= 5, {
    message: "Com nota de corte ou pesos, a fonte é obrigatória (ao menos 5 caracteres).",
  });

/** Cria uma meta de curso (até 3 ativas). Números só entram com a fonte. */
export async function addCourseGoal(input: unknown): Promise<Result> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para salvar a meta." };
  const { count } = await supabase.from("course_goals").select("id", { count: "exact", head: true }).is("archived_at", null);
  if ((count ?? 0) >= 3) return { ok: false, message: "Até 3 metas ativas. Arquive uma para criar outra." };
  const w = p.data.weights && Object.fromEntries(Object.entries(p.data.weights).filter(([, v]) => v !== undefined));
  const { error } = await supabase.from("course_goals").insert({
    course: p.data.course,
    institution: p.data.institution,
    modality: p.data.modality || null,
    cutoff: p.data.cutoff,
    weights: w && Object.keys(w).length ? w : null,
    source: p.data.source || null,
  });
  if (error) return { ok: false, message: "Não foi possível salvar. Confira os campos." };
  revalidatePath("/progresso");
  revalidatePath("/progresso/meta");
  return { ok: true };
}

/** Arquiva a meta (fica no histórico; não é apagada). */
export async function archiveCourseGoal(input: unknown): Promise<Result> {
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("course_goals").update({ archived_at: new Date().toISOString() }).eq("id", p.data.id);
  if (error) return { ok: false, message: "Não foi possível arquivar." };
  revalidatePath("/progresso");
  revalidatePath("/progresso/meta");
  return { ok: true };
}
