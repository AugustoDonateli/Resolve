import "server-only";
import { ADAPTIVE_RULE, chooseTrainingFocus, type AreaStat } from "@/lib/routine/planner";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { pickSuggestion, type Suggestion } from "./suggestion-rule";

/** Sugestão para agora, com os dados da conta; null sem sessão (a tela mostra só as portas). */
export async function loadSuggestion(): Promise<Suggestion | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const since = new Date(Date.now() - ADAPTIVE_RULE.windowDays * 86_400_000).toISOString();
  const [queue, recent] = await Promise.all([
    supabase.rpc("review_queue", { p_available_minutes: 600 }),
    supabase.from("attempts").select("item_version_id, is_correct, submitted_at").eq("is_repeat", false).eq("help_seen", false).gte("submitted_at", since),
  ]);
  const rows = (recent.data ?? []) as { item_version_id: string; is_correct: boolean | null; submitted_at: string }[];
  const areas: AreaStat["area"][] = ["LC", "CH", "CN", "MT"];
  const stats = new Map(areas.map((a) => [a, { area: a, answers: 0, wrong: 0, daysSinceLast: null as number | null }]));
  if (rows.length) {
    const ids = [...new Set(rows.map((r) => r.item_version_id))];
    const { data } = await supabase.from("study_items").select("item_version_id, area").in("item_version_id", ids);
    const areaOf = new Map((data ?? []).map((r) => [r.item_version_id as string, r.area as AreaStat["area"]]));
    const now = new Date().getTime();
    for (const r of rows) {
      const s = stats.get(areaOf.get(r.item_version_id) as AreaStat["area"]);
      if (!s || r.is_correct === null) continue;
      s.answers += 1;
      if (!r.is_correct) s.wrong += 1;
      const days = Math.floor((now - new Date(r.submitted_at).getTime()) / 86_400_000);
      s.daysSinceLast = s.daysSinceLast === null ? days : Math.min(s.daysSinceLast, days);
    }
  }
  return pickSuggestion({
    reviewDue: queue.error ? null : ((queue.data as unknown[] | null) ?? []).length,
    focus: chooseTrainingFocus([...stats.values()]),
  });
}
