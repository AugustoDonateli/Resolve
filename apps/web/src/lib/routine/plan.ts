import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { dateInZone } from "./schedule-types";

export interface DayBlock {
  id: string;
  start_minute: number;
  planned_minutes: number;
  kind: "revisao" | "treino" | "redacao";
  title: string;
  reason: string | null;
  status: string;
}

export type LeftOutEntry =
  | { title: string; minutes: number; why: string }
  | { note: string };

export interface DayPlan {
  today: string;
  blocks: DayBlock[];
  leftOut: LeftOutEntry[];
  generatedAt: string | null;
}

export async function loadDayPlan(): Promise<DayPlan | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let today: string;
  try {
    today = dateInZone(new Date(), profile?.timezone ?? "America/Sao_Paulo");
  } catch {
    today = dateInZone(new Date(), "America/Sao_Paulo");
  }
  const [b, d] = await Promise.all([
    supabase
      .from("study_blocks")
      .select("id, start_minute, planned_minutes, kind, title, reason, status")
      .eq("local_date", today)
      .order("start_minute"),
    supabase
      .from("study_plan_days")
      .select("left_out, generated_at")
      .eq("local_date", today)
      .maybeSingle(),
  ]);
  return {
    today,
    blocks: (b.data ?? []) as DayBlock[],
    leftOut: (d.data?.left_out ?? []) as LeftOutEntry[],
    generatedAt: d.data?.generated_at ?? null,
  };
}
