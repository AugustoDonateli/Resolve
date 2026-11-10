import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface StreakView {
  streak: number;
  ruleVersion: string;
  today: string;
  restThisWeek: number;
  lastDays: { day: string; active: boolean; rest: boolean }[];
  upcomingRest: string[];
}

export async function loadStreak(): Promise<StreakView | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.rpc("streak_status");
  const row = (
    data as
      | {
          streak: number;
          rule_version: string;
          today: string;
          rest_this_week: number;
          last_days: StreakView["lastDays"];
        }[]
      | null
  )?.[0];
  if (!row) return null;
  const { data: rest } = await supabase
    .from("rest_days")
    .select("rest_date")
    .gte("rest_date", row.today)
    .order("rest_date");
  return {
    streak: row.streak,
    ruleVersion: row.rule_version,
    today: row.today,
    restThisWeek: row.rest_this_week,
    lastDays: row.last_days ?? [],
    upcomingRest: (rest ?? []).map((r) => r.rest_date),
  };
}
