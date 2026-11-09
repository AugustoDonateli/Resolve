"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "./data";
import { cleanTags, reviewSchema } from "./tags";

export type TagResult = { ok: true; decision: string } | { ok: false; problems: string[] };

/** Lista do que ainda impede aprovar, calculada pelo banco (mesma regra do gatilho). */
export async function checkTagReview(input: unknown): Promise<TagResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => i.message) };
  const { supabase } = await requireEditor();
  const { data, error } = await supabase.rpc("tag_review_problems", {
    p_proposal: parsed.data.proposalId,
    p_tags: cleanTags(parsed.data.tags),
    p_checklist: parsed.data.checklist,
  });
  if (error) return { ok: false, problems: ["Não foi possível conferir agora. Tente de novo."] };
  const problems = (data as string[]) ?? [];
  return problems.length ? { ok: false, problems } : { ok: true, decision: "pronta para aprovar" };
}

/** Registra a decisão. O banco recusa aprovar com pendência e guarda tudo de forma imutável. */
export async function submitTagReview(input: unknown): Promise<TagResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => i.message) };
  const r = parsed.data;
  if (r.decision !== "aprovar" && r.notes.trim().length < 10) {
    return { ok: false, problems: ["Explique o motivo (mínimo de 10 caracteres) para devolver ou rejeitar."] };
  }
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("proposal_tag_reviews").insert({
    proposal_id: r.proposalId,
    proposal_revision: r.proposalRevision,
    decision: r.decision,
    tags: cleanTags(r.tags),
    checklist: r.checklist,
    notes: r.notes || null,
    suggestion_id: r.suggestionId,
  });
  if (error) {
    if (error.message.includes("resolve_review_incomplete")) {
      return { ok: false, problems: (error.hint ?? "").split("; ").filter(Boolean) };
    }
    if (error.message.includes("resolve_review_stale")) {
      return { ok: false, problems: ["O conteúdo da questão mudou depois que você abriu esta tela. Recarregue e confira de novo."] };
    }
    return { ok: false, problems: ["Não foi possível registrar a decisão."] };
  }
  revalidatePath(`/editor/proposta/${r.proposalId}`);
  revalidatePath(`/editor/proposta/${r.proposalId}/etiquetas`);
  revalidatePath("/editor");
  return { ok: true, decision: r.decision };
}
