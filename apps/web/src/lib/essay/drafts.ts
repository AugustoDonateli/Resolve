import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fromParagraphs } from "./draft";

export interface EssaySummary {
  id: string;
  created_at: string;
  promptTitle: string | null;
  status: "rascunho" | "submetida";
  preview: string;
  updated_at: string;
}

export interface DraftView {
  essayId: string;
  versionId: string;
  revision: number;
  status: "rascunho" | "submetida";
  text: string;
  promptTitle: string | null;
  promptId: string | null;
}

/** Redações da conta do login (a versão mais recente de cada uma). */
export async function listMyEssays(): Promise<EssaySummary[] | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("essays")
    .select(
      "id, created_at, essay_prompts(title), essay_versions(status, plain_text, updated_at, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((e) => {
    const vs = (
      (e.essay_versions ?? []) as {
        status: "rascunho" | "submetida";
        plain_text: string;
        updated_at: string;
        created_at: string;
      }[]
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const v = vs[0];
    const text = v?.plain_text ?? "";
    return {
      id: e.id,
      created_at: e.created_at,
      promptTitle:
        (e.essay_prompts as unknown as { title: string } | null)?.title ?? null,
      status: v?.status ?? "rascunho",
      preview: text.length > 140 ? `${text.slice(0, 137)}…` : text,
      updated_at: v?.updated_at ?? e.created_at,
    };
  });
}

/** Versão mais recente da redação (rascunho ou enviada). */
export async function loadDraft(essayId: string): Promise<DraftView> {
  if (!/^[0-9a-f-]{36}$/.test(essayId)) notFound();
  const supabase = await createClient();
  const { data: essay } = await supabase
    .from("essays")
    .select("id, prompt_id, essay_prompts(title)")
    .eq("id", essayId)
    .maybeSingle();
  if (!essay) notFound();
  const { data: v } = await supabase
    .from("essay_versions")
    .select("id, revision, status, paragraphs_json")
    .eq("essay_id", essayId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!v) notFound();
  return {
    essayId,
    versionId: v.id,
    revision: v.revision,
    status: v.status,
    text: fromParagraphs((v.paragraphs_json ?? []) as { text: string }[]),
    promptTitle:
      (essay.essay_prompts as unknown as { title: string } | null)?.title ??
      null,
    promptId: essay.prompt_id,
  };
}
