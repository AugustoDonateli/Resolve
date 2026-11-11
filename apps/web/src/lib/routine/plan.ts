import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "./exam";
import { dateInZone, minuteInZone } from "./schedule-types";

export interface DayBlock {
  id: string;
  start_minute: number;
  planned_minutes: number;
  kind: "revisao" | "treino" | "redacao";
  title: string;
  reason: string | null;
  status: string;
  area_code: string | null;
  actual_minutes: number | null;
}

export type LeftOutEntry =
  | { title: string; minutes: number; why: string }
  | { note: string };

export interface DayPlan {
  today: string;
  timezone: string;
  /** Compromissos e horários livres de hoje, em minutos do dia (para a agenda e a remarcação). */
  commitments: { title: string; start: number; end: number }[];
  available: { start: number; end: number }[];
  blocks: DayBlock[];
  leftOut: LeftOutEntry[];
  generatedAt: string | null;
  /** Minuto atual no fuso do perfil (a mesma referência do plano). */
  nowMinute: number;
  /** 1º dia da prova informado pela conta (provisório) e dias até lá. */
  examDay: string | null;
  daysToExam: number | null;
}

export async function loadDayPlan(): Promise<DayPlan | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, exam_day1")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let timezone = profile?.timezone ?? "America/Sao_Paulo";
  let today: string;
  try {
    today = dateInZone(new Date(), timezone);
  } catch {
    timezone = "America/Sao_Paulo";
    today = dateInZone(new Date(), timezone);
  }
  const [b, d, occ] = await Promise.all([
    supabase
      .from("study_blocks")
      .select("id, start_minute, planned_minutes, kind, title, reason, status, area_code, actual_minutes")
      .eq("local_date", today)
      .order("start_minute"),
    supabase
      .from("study_plan_days")
      .select("left_out, generated_at")
      .eq("local_date", today)
      .maybeSingle(),
    supabase.rpc("schedule_occurrences", { p_from: today, p_to: today }),
  ]);
  const toMin = (local: string, edge: "start" | "end") => {
    const d0 = local.slice(0, 10);
    if (d0 < today) return 0;
    if (d0 > today) return edge === "end" ? 1440 : 1440;
    return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  };
  const rows = (occ.data ?? []) as {
    kind: string;
    title: string | null;
    local_start: string;
    local_end: string;
  }[];
  const commitments = rows
    .filter((o) => o.kind === "compromisso")
    .map((o) => ({
      title: o.title ?? "Compromisso",
      start: toMin(o.local_start, "start"),
      end: toMin(o.local_end, "end"),
    }));
  const available = rows
    .filter((o) => o.kind === "disponivel")
    .map((o) => ({
      start: toMin(o.local_start, "start"),
      end: toMin(o.local_end, "end"),
    }));
  return {
    today,
    timezone,
    commitments,
    available,
    blocks: (b.data ?? []) as DayBlock[],
    leftOut: (d.data?.left_out ?? []) as LeftOutEntry[],
    generatedAt: d.data?.generated_at ?? null,
    nowMinute: minuteInZone(new Date(), timezone),
    examDay: profile?.exam_day1 ?? null,
    daysToExam: profile?.exam_day1 ? daysUntil(today, profile.exam_day1) : null,
  };
}
