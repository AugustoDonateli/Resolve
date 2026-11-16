import "server-only";
import { cache } from "react";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { EXAM_DAY_GUESS, parseGuide, type FichaDefaults, type GuideState } from "./types";

/** O que a conta já viu do guia; null sem sessão (modo local ou visitante). Uma leitura por pedido. */
export const loadGuide = cache(async (): Promise<{ guide: GuideState; weeklyHours: number | null; examDay: string | null } | null> => {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("guide, weekly_hours, exam_day1").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { guide: parseGuide(data.guide), weeklyHours: data.weekly_hours as number | null, examDay: data.exam_day1 as string | null };
});

/** Respostas da ficha de identificação já guardadas na conta, para preencher o formulário. */
export async function loadFicha(): Promise<FichaDefaults | null> {
  const base = await loadGuide();
  if (!base) return null;
  const supabase = await createClient();
  const [{ data: prefs }, { data: goals }] = await Promise.all([
    supabase.from("user_preferences").select("default_language").maybeSingle(),
    supabase.from("course_goals").select("course, institution").is("archived_at", null).order("created_at").limit(1),
  ]);
  const goal = goals?.[0];
  return {
    course: (goal?.course as string | undefined) ?? "",
    institution: (goal?.institution as string | undefined) ?? "",
    goalLocked: Boolean(goal),
    weeklyHours: base.weeklyHours,
    language: (prefs?.default_language as FichaDefaults["language"] | undefined) ?? null,
    examDay: base.examDay ?? EXAM_DAY_GUESS,
    examDayFromAccount: base.examDay !== null,
  };
}
