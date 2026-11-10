import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { StudyItemRow } from "./question-types";

export async function loadQuestionAssets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questions: StudyItemRow[],
  seconds = 60 * 60,
) {
  const ids = new Set<string>();
  const collect = (blocks: { asset_id?: string }[] | null | undefined) =>
    blocks?.forEach((b) => b.asset_id && ids.add(b.asset_id));
  for (const question of questions) {
    collect(question.stimulus_blocks);
    collect(question.command_blocks);
    question.alternatives.forEach((a) => collect(a.content_blocks));
  }
  const assets: Record<string, { url: string | null; alt: string | null }> = {};
  const idList = [...ids];
  for (let offset = 0; offset < idList.length; offset += 100) {
    const { data: rows } = await supabase
      .from("assets")
      .select("id, storage_path, alt_text")
      .in("id", idList.slice(offset, offset + 100));
    const paths = (rows ?? []).map((r) => r.storage_path);
    const { data: signed } = paths.length
      ? await supabase.storage.from("editorial").createSignedUrls(paths, seconds)
      : { data: [] };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const r of rows ?? [])
      assets[r.id] = {
        url: urlByPath.get(r.storage_path) ?? null,
        alt: r.alt_text ?? null,
      };
  }
  return assets;
}
