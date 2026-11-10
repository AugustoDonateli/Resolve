import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { MotivatingText, PromptDetail, PromptSummary } from "./prompt-types";

export type { MotivatingText, PromptBlock, PromptDetail, PromptSummary } from "./prompt-types";
export { ROMAN } from "./prompt-types";

const PROMPT_COLS = "id, title, origin, edition, status, published_at, instruction, source_locator";
const TEXT_COLS = "id, position, blocks, citation, page_or_locator, rights_status, verified_at";

/** Busca um tema com os textos e assina as figuras. As políticas do banco decidem o que a conta vê. */
export async function loadPrompt(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<PromptDetail | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [{ data: p }, { data: texts }] = await Promise.all([
    supabase.from("essay_prompts").select(PROMPT_COLS).eq("id", id).maybeSingle(),
    supabase.from("motivating_texts").select(TEXT_COLS).eq("prompt_id", id).order("position"),
  ]);
  if (!p) return null;
  const list = (texts ?? []) as MotivatingText[];
  const refs = list.flatMap((t) => t.blocks.filter((b) => b.type === "image" && b.asset_ref).map((b) => b.asset_ref!));
  const figureUrls: Record<string, string> = {};
  if (refs.length) {
    const { data: signed } = await supabase.storage.from("editorial").createSignedUrls(refs, 60 * 30);
    for (const s of signed ?? []) if (s.signedUrl && s.path) figureUrls[s.path] = s.signedUrl;
  }
  return { ...(p as Omit<PromptDetail, "texts" | "figureUrls">), texts: list, figureUrls };
}

/** Temas publicados, para o aluno. */
export async function listPublishedPrompts(): Promise<PromptSummary[]> {
  if (!authEnabled) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("essay_prompts")
    .select("id, title, origin, edition, status, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []) as PromptSummary[];
}

export async function getPublishedPrompt(id: string): Promise<PromptDetail> {
  if (!authEnabled) notFound();
  const supabase = await createClient();
  const p = await loadPrompt(supabase, id);
  if (!p || p.status !== "published") notFound();
  return p;
}
