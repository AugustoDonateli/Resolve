import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { addDays, dateInZone } from "./schedule-types";

export interface WeeklyDay {
  date: string;
  plannedMinutes: number;
  doneMinutes: number;
  blocksDone: number;
  blocksPlanned: number;
  answers: number;
  correct: number;
  reviews: number;
  essays: number;
}

export interface WeeklyReport {
  from: string;
  to: string;
  today: string;
  days: WeeklyDay[];
  totals: { planned: number; done: number; blocksDone: number; blocksPlanned: number; answers: number; correct: number; reviews: number; essays: number };
  /** Minutos feitos por área nos blocos concluídos (blocos sem área ficam em "geral"). */
  byArea: { area: string; minutes: number; targetMinutes: number | null }[];
  weeklyGoal: number | null;
  dailyGoal: number | null;
}

/**
 * Relatório dos últimos 7 dias no fuso do perfil: o que foi planejado e feito nos blocos (minutos
 * registrados pelo foco), respostas, revisões e redações enviadas. Só contagens do que aconteceu;
 * nenhuma inferência de atenção, cansaço ou desempenho.
 */
export async function loadWeeklyReport(): Promise<WeeklyReport | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle();
  const tz = profile?.timezone ?? "America/Sao_Paulo";
  const today = dateInZone(new Date(), tz);
  const from = addDays(today, -6);
  const sinceIso = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const [blocks, attempts, reviews, essays, goals] = await Promise.all([
    supabase.from("study_blocks").select("local_date, planned_minutes, actual_minutes, status, area_code").gte("local_date", from).lte("local_date", today),
    supabase.from("attempts").select("submitted_at, is_correct").gte("submitted_at", sinceIso),
    supabase.from("card_reviews").select("local_date").gte("local_date", from),
    supabase.from("essay_versions").select("submitted_at").eq("status", "submetida").gte("submitted_at", sinceIso),
    supabase.from("goals").select("level, area_code, target_minutes").is("archived_at", null),
  ]);
  const days: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(from, i),
    plannedMinutes: 0,
    doneMinutes: 0,
    blocksDone: 0,
    blocksPlanned: 0,
    answers: 0,
    correct: 0,
    reviews: 0,
    essays: 0,
  }));
  const at = (d: string) => days.find((x) => x.date === d);
  const area = new Map<string, number>();
  for (const b of blocks.data ?? []) {
    const d = at(b.local_date);
    if (!d || b.status === "dispensado") continue;
    d.plannedMinutes += b.planned_minutes;
    d.blocksPlanned += 1;
    if (b.status === "concluido") {
      const m = b.actual_minutes ?? 0;
      d.doneMinutes += m;
      d.blocksDone += 1;
      area.set(b.area_code ?? "geral", (area.get(b.area_code ?? "geral") ?? 0) + m);
    }
  }
  for (const a of attempts.data ?? []) {
    const d = at(dateInZone(a.submitted_at, tz));
    if (!d) continue;
    d.answers += 1;
    if (a.is_correct) d.correct += 1;
  }
  for (const r of reviews.data ?? []) {
    const d = at(r.local_date);
    if (d) d.reviews += 1;
  }
  for (const e of essays.data ?? []) {
    const d = e.submitted_at ? at(dateInZone(e.submitted_at, tz)) : undefined;
    if (d) d.essays += 1;
  }
  const g = goals.data ?? [];
  const areaTargets = new Map(g.filter((x) => x.level === "area" && x.area_code).map((x) => [x.area_code as string, x.target_minutes]));
  const areas = new Set([...area.keys(), ...areaTargets.keys()]);
  const sum = (k: keyof WeeklyDay) => days.reduce((s, d) => s + (d[k] as number), 0);
  return {
    from,
    to: today,
    today,
    days,
    totals: {
      planned: sum("plannedMinutes"),
      done: sum("doneMinutes"),
      blocksDone: sum("blocksDone"),
      blocksPlanned: sum("blocksPlanned"),
      answers: sum("answers"),
      correct: sum("correct"),
      reviews: sum("reviews"),
      essays: sum("essays"),
    },
    byArea: [...areas].map((a) => ({ area: a, minutes: area.get(a) ?? 0, targetMinutes: areaTargets.get(a) ?? null })),
    weeklyGoal: g.find((x) => x.level === "semanal")?.target_minutes ?? null,
    dailyGoal: g.find((x) => x.level === "diaria")?.target_minutes ?? null,
  };
}
