import "server-only";
import { notFound } from "next/navigation";
import { loadPrompt, type PromptDetail, type PromptSummary } from "@/lib/essay/prompts";
import { requireEditor } from "./data";

export interface EditorPromptRow extends PromptSummary {
  texts: number;
  verified: number;
}

export async function listEditorPrompts(): Promise<EditorPromptRow[]> {
  const { supabase } = await requireEditor();
  const { data } = await supabase
    .from("essay_prompts")
    .select("id, title, origin, edition, status, published_at, motivating_texts(rights_status)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => {
    const t = (p.motivating_texts ?? []) as { rights_status: string }[];
    const summary: PromptSummary = { id: p.id, title: p.title, origin: p.origin, edition: p.edition, status: p.status, published_at: p.published_at };
    return { ...summary, texts: t.length, verified: t.filter((x) => x.rights_status === "verificado").length };
  });
}

export interface EditorPromptDetail extends PromptDetail {
  blockers: string[];
  pageUrl: string | null;
}

export async function getEditorPrompt(id: string): Promise<EditorPromptDetail> {
  const { supabase } = await requireEditor();
  const p = await loadPrompt(supabase, id);
  if (!p) notFound();
  const [{ data: blockers }, { data: src }] = await Promise.all([
    supabase.rpc("essay_prompt_blockers", { p_prompt: id }),
    supabase.from("essay_prompts").select("source_id, sources(sha256)").eq("id", id).single(),
  ]);
  // página do caderno renderizada pelo carregador (temas/paginas/<sha256>-<página>.webp)
  let pageUrl: string | null = null;
  const sha = (src?.sources as unknown as { sha256: string } | null)?.sha256;
  const page = p.source_locator?.match(/p\. (\d+)/)?.[1];
  if (sha && page) {
    const s = await supabase.storage.from("editorial").createSignedUrl(`temas/paginas/${sha}-${page}.webp`, 60 * 30);
    pageUrl = s.data?.signedUrl ?? null;
  }
  return { ...p, blockers: (blockers as string[] | null) ?? [], pageUrl };
}
