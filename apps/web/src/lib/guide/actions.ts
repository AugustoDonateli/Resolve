"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fichaSchema, GUIDE_KEYS } from "./types";

type Result = { ok: true } | { ok: false; message: string };

/** Marca uma parte do guia como vista (a primeira vez vale; repetir não muda nada). */
export async function markGuide(input: unknown): Promise<Result> {
  const key = z.enum(GUIDE_KEYS).safeParse(input);
  if (!key.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_guide", { p_key: key.data });
  if (error) return { ok: false, message: "Não foi possível guardar agora." };
  return { ok: true };
}

/** Rever o tutorial: os primeiros passos e as dicas voltam a aparecer. As respostas da ficha ficam. */
export async function resetGuide(): Promise<Result> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para rever o tutorial." };
  const { error } = await supabase.rpc("reset_guide");
  if (error) return { ok: false, message: "Não foi possível recomeçar agora. Tente de novo." };
  revalidatePath("/hoje");
  revalidatePath("/mais/como-funciona");
  return { ok: true };
}

/**
 * Ficha de identificação: horas por semana e data da prova (perfil), língua estrangeira (preferências) e,
 * se informados, curso e instituição como meta de curso (sem nota de corte: número só entra com fonte).
 * O que ficou em branco não apaga o que a conta já tinha.
 */
export async function saveFicha(input: unknown): Promise<Result> {
  const p = fichaSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Confira os campos da ficha." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para guardar a ficha." };
  const v = p.data;

  const profile: Record<string, unknown> = {};
  if (v.weeklyHours !== null) profile.weekly_hours = v.weeklyHours;
  if (v.examDay !== null) profile.exam_day1 = v.examDay;
  if (Object.keys(profile).length) {
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", auth.user.id);
    if (error) return { ok: false, message: /check/.test(error.message) ? "Confira as horas por semana e a data da prova." : "Não foi possível guardar a ficha. Tente de novo." };
  }
  if (v.language) {
    const { error } = await supabase.from("user_preferences").update({ default_language: v.language }).eq("user_id", auth.user.id);
    if (error) return { ok: false, message: "Não foi possível guardar a língua estrangeira. Tente de novo." };
  }
  if (v.course && v.institution) {
    const { data: goals } = await supabase.from("course_goals").select("course, institution").is("archived_at", null);
    const same = (goals ?? []).some((g) => g.course === v.course && g.institution === v.institution);
    if (!same && (goals ?? []).length < 3) {
      const { error } = await supabase.from("course_goals").insert({ course: v.course, institution: v.institution });
      if (error) return { ok: false, message: "Não foi possível guardar o curso. Confira os dois campos." };
    }
  }
  const { error } = await supabase.rpc("mark_guide", { p_key: "ficha" });
  if (error) return { ok: false, message: "A ficha foi guardada, mas não deu para concluir o passo. Tente de novo." };
  revalidatePath("/hoje");
  revalidatePath("/rotina");
  revalidatePath("/progresso");
  revalidatePath("/progresso/meta");
  return { ok: true };
}

/**
 * Primeira questão: uma questão real que a maioria acertou na prova, só de texto, ainda não respondida
 * pela conta. Abre uma sessão de uma questão; reenviar com o mesmo `actionId` devolve a mesma sessão.
 */
export async function startFirstQuestion(input: unknown): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
  const p = z.object({ actionId: z.uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para responder." };
  const { data: pick, error: pickError } = await supabase.rpc("first_question");
  const row = (pick as { item_version_id: string }[] | null)?.[0];
  if (pickError || !row) return { ok: false, message: "Não há questão para abrir agora. Você pode começar pelo caderno, em Estudar." };
  const { data, error } = await supabase.rpc("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "treino",
    p_item_version_ids: [row.item_version_id],
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "plano",
  });
  if (error || typeof data !== "string") return { ok: false, message: "Não foi possível abrir a questão. Tente de novo." };
  return { ok: true, sessionId: data };
}
