import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ReviewQueueRow } from "./actions";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  kind: string;
  source: string | null;
  locator: string;
}

export interface ReviewHome {
  minutes: number;
  minutesPerItem: number;
  rows: ReviewQueueRow[];
  cards: Record<string, ReviewCard>;
  nextDue: string | null;
}

/** Fila do dia (F3-T08): sem seleção manual; o tempo disponível define o lote e o resto fica visível. */
export async function loadReviewHome(
  minutes: number,
): Promise<ReviewHome | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: rows } = await supabase.rpc("review_queue", {
    p_available_minutes: minutes,
  });
  const queue = (rows ?? []) as ReviewQueueRow[];
  const cardIds = queue
    .filter((r) => r.kind === "cartao" && r.card_id)
    .map((r) => r.card_id!);
  const cards: Record<string, ReviewCard> = {};
  if (cardIds.length) {
    const { data } = await supabase
      .from("concept_cards")
      .select("id, front, back, kind, source_locator, sources(title)")
      .in("id", cardIds);
    for (const c of data ?? []) {
      const src = c.sources as unknown as { title: string } | null;
      cards[c.id] = {
        id: c.id,
        front: c.front,
        back: c.back,
        kind: c.kind,
        source: src?.title ?? null,
        locator: c.source_locator,
      };
    }
  }
  let nextDue: string | null = null;
  if (!queue.length) {
    const [q, c] = await Promise.all([
      supabase
        .from("review_items")
        .select("due_date")
        .eq("status", "ativa")
        .order("due_date")
        .limit(1),
      supabase
        .from("card_review_items")
        .select("due_date")
        .eq("status", "ativa")
        .order("due_date")
        .limit(1),
    ]);
    const ds = [q.data?.[0]?.due_date, c.data?.[0]?.due_date].filter(
      Boolean,
    ) as string[];
    nextDue = ds.sort()[0] ?? null;
  }
  return {
    minutes,
    minutesPerItem: queue[0]?.minutes_per_item ?? 3,
    rows: queue,
    cards,
    nextDue,
  };
}
