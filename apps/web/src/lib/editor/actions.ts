"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "./data";
import { applyEdit, changedFields, editSchema, textProblem, type ProposalPayload } from "./payload";

export type SaveResult =
  | { ok: true; revision: number; status: string; changed: string[] }
  | { ok: false; reason: "invalid" | "conflict" | "unchanged" | "error"; message: string; currentRevision?: number };

/** Salva a correção como revisão nova. A revisão anterior continua no histórico. */
export async function saveRevision(input: unknown): Promise<SaveResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const edit = parsed.data;
  const { supabase } = await requireEditor();
  const { data: row } = await supabase.from("item_proposals").select("payload, current_revision").eq("id", edit.proposalId).maybeSingle();
  if (!row) return { ok: false, reason: "error", message: "Proposta não encontrada." };
  if (row.current_revision !== edit.expectedRevision) {
    return { ok: false, reason: "conflict", message: `Outra correção foi salva (revisão ${row.current_revision}). Recarregue para ver a versão atual antes de salvar.`, currentRevision: row.current_revision };
  }
  const current = row.payload as ProposalPayload;
  const next = applyEdit(current, edit);
  const changed = changedFields(current, next);
  if (changed.length === 0) return { ok: false, reason: "unchanged", message: "Nada mudou em relação à revisão atual." };

  const { data, error } = await supabase.rpc("revise_proposal", {
    p_id: edit.proposalId,
    p_expected_revision: edit.expectedRevision,
    p_payload: next,
    p_note: edit.note,
    p_changed: changed,
  });
  if (error) {
    if (error.message.includes("resolve_revision_conflict")) {
      return { ok: false, reason: "conflict", message: "Outra correção foi salva enquanto você editava. Recarregue para ver a versão atual." };
    }
    if (error.code === "23514") return { ok: false, reason: "invalid", message: "O banco recusou o conteúdo (texto inseguro ou formato inválido)." };
    return { ok: false, reason: "error", message: "Não foi possível salvar. Tente de novo." };
  }
  const result = (Array.isArray(data) ? data[0] : data) as { revision: number; status: string };
  revalidatePath(`/editor/proposta/${edit.proposalId}`);
  revalidatePath("/editor");
  return { ok: true, revision: result.revision, status: result.status, changed };
}

const doubtSchema = z.object({
  proposalId: z.string().uuid(),
  doubtId: z.string().uuid(),
  decision: z.enum(["resolvida", "descartada"]),
  resolution: z.string().trim().min(3, "Explique como a dúvida foi resolvida.").max(2000),
});

export type DoubtResult = { ok: true; status: string | null } | { ok: false; message: string };

/** Fecha uma dúvida com a explicação do editor; a proposta volta a "válida" se não restar nenhuma. */
export async function closeDoubt(input: unknown): Promise<DoubtResult> {
  const parsed = doubtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const problem = textProblem(parsed.data.resolution);
  if (problem) return { ok: false, message: problem };
  const { supabase, user } = await requireEditor();
  const { data, error } = await supabase
    .from("doubt_queue")
    .update({ status: parsed.data.decision, resolution: parsed.data.resolution, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.doubtId)
    .eq("proposal_id", parsed.data.proposalId)
    .eq("status", "aberta")
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Não foi possível fechar a dúvida (já fechada ou sem permissão)." };
  const { data: status } = await supabase.rpc("refresh_proposal_status", { p_id: parsed.data.proposalId });
  revalidatePath(`/editor/proposta/${parsed.data.proposalId}`);
  revalidatePath("/editor");
  return { ok: true, status: (status as string | null) ?? null };
}
