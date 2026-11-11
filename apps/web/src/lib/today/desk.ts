import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Números que aparecem nos objetos da mesa. `null` = indisponível (o objeto aparece sem número). */
export interface DeskCounts {
  /** Itens de revisão vencidos hoje (questões e cartões). */
  reviewDue: number | null;
  /** Questões oficiais publicadas. */
  questions: number | null;
}

export async function loadDeskCounts(): Promise<DeskCounts> {
  if (!authEnabled) return { reviewDue: null, questions: null };
  const supabase = await createClient();
  const [review, questions] = await Promise.all([
    supabase.rpc("review_queue", { p_available_minutes: 600 }),
    supabase.from("study_items").select("item_version_id", { count: "exact", head: true }).eq("annulled", false),
  ]);
  return {
    reviewDue: review.error ? null : ((review.data as unknown[] | null) ?? []).length,
    questions: questions.error ? null : (questions.count ?? null),
  };
}
