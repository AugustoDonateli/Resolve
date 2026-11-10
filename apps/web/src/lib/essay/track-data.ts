import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface TrackData {
  done: string[];
  /** Título e descrição do nível 200 de cada competência, da rubrica oficial registrada. */
  rubric: Record<string, { title: string; top: string | null; page: number | null }>;
}

export async function loadTrack(): Promise<TrackData | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: prog }, { data: dims }] = await Promise.all([
    supabase.from("essay_track_progress").select("step, done"),
    supabase.from("rubric_dimensions").select("code, title, levels, essay_rubrics!inner(version)").eq("essay_rubrics.version", "enem-redacao-v1"),
  ]);
  const rubric: TrackData["rubric"] = {};
  for (const d of dims ?? []) {
    const top = (d.levels as { score: number; description: string; page?: number }[]).find((l) => l.score === 200);
    rubric[d.code] = { title: d.title, top: top?.description ?? null, page: top?.page ?? null };
  }
  return { done: (prog ?? []).filter((p) => p.done).map((p) => p.step), rubric };
}
