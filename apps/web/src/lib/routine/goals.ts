import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface Goal {
  id: string;
  level: "diaria" | "semanal" | "area";
  area_code: "LC" | "MT" | "CN" | "CH" | "RED" | null;
  target_minutes: number | null;
  target_score: number | null;
  archived_at: string | null;
}

export interface IfThenPlan {
  id: string;
  trigger_text: string;
  alternative_activity: string;
  duration_minutes: number;
  priority: number;
  archived_at: string | null;
}

/** Metas e planos da conta do login, ativos e arquivados. */
export async function loadGoals(): Promise<{
  goals: Goal[];
  plans: IfThenPlan[];
} | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [g, p] = await Promise.all([
    supabase
      .from("goals")
      .select("id, level, area_code, target_minutes, target_score, archived_at")
      .order("archived_at", { nullsFirst: true })
      .order("created_at"),
    supabase
      .from("if_then_plans")
      .select(
        "id, trigger_text, alternative_activity, duration_minutes, priority, archived_at",
      )
      .order("archived_at", { nullsFirst: true })
      .order("priority")
      .order("created_at"),
  ]);
  return {
    goals: (g.data ?? []) as Goal[],
    plans: (p.data ?? []) as IfThenPlan[],
  };
}
