import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface DailyQuestion {
  itemVersionId: string;
  area: "LC" | "CH" | "CN" | "MT";
  answered: boolean;
  isCorrect: boolean | null;
}

/** Questão do dia (mesma o dia inteiro); null sem conta ou sem questões publicadas que faltem responder. */
export async function loadDailyQuestion(today: string): Promise<DailyQuestion | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("daily_question", { p_local_date: today });
  const row = (data as { item_version_id: string; area: DailyQuestion["area"]; answered: boolean; is_correct: boolean | null }[] | null)?.[0];
  if (error || !row) return null;
  return { itemVersionId: row.item_version_id, area: row.area, answered: row.answered, isCorrect: row.is_correct };
}
