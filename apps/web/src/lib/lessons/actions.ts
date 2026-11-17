"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { itemVersionIds } from "./data";
import { lessonBySlug } from "./index";

/** Questões sozinho: abre uma sessão de treino com as questões reais escolhidas para a lição. */
export async function startLessonPractice(input: unknown): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  const p = z.object({ slug: z.string().max(60), actionId: z.uuid() }).safeParse(input);
  const lesson = p.success ? lessonBySlug(p.data.slug) : undefined;
  if (!p.success || !lesson) return { ok: false, message: "Lição não encontrada." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para resolver as questões." };
  const ids = await itemVersionIds(lesson.practice.qs);
  if (!ids.length) return { ok: false, message: "As questões desta lição não estão disponíveis agora." };
  const { data, error } = await supabase.rpc("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "treino",
    p_item_version_ids: ids,
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "escolha",
  });
  if (error || typeof data !== "string") return { ok: false, message: "Não foi possível abrir as questões. Tente de novo." };
  return { ok: true, sessionId: data };
}

const SECTIONS = ["entrada", "explicacao", "exemplo", "lacunas", "treino", "pegadinhas", "cartoes"] as const;

/** Marcação de uma parte da lição: entendi, confuso ou chato, com nota opcional. Trocar a marcação substitui a anterior. */
export async function rateLessonSection(input: unknown): Promise<{ ok: boolean; message?: string }> {
  const p = z
    .object({ slug: z.string().max(60), section: z.enum(SECTIONS), verdict: z.enum(["entendi", "confuso", "chato"]), note: z.string().trim().max(500).optional() })
    .safeParse(input);
  if (!p.success || !lessonBySlug(p.data.slug)) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para marcar." };
  const { error } = await supabase.from("lesson_feedback").upsert(
    { lesson_slug: p.data.slug, section: p.data.section, verdict: p.data.verdict, note: p.data.note || null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_slug,section" },
  );
  if (error) return { ok: false, message: "Não foi possível guardar a marcação." };
  revalidatePath(`/estudar/licoes/${p.data.slug}`);
  return { ok: true };
}
