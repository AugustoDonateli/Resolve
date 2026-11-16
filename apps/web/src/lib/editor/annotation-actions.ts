"use server";

import { z } from "zod";
import { requireEditor } from "./data";
import { payloadSchema } from "./annotation-types";

export type ReviewResult = { ok: true } | { ok: false; problem: string };

const id = z.uuid();
const note = z.string().trim().max(1000);

function problemOf(error: { message: string; hint?: string | null }): string {
  if (error.message.includes("resolve_annotation_not_open")) return "Esta anotação já foi conferida ou devolvida. Passe para a próxima.";
  if (error.message.includes("resolve_annotation_not_pending")) return "A questão já tem anotação aprovada. Corrigir agora cria uma versão nova da questão.";
  if (error.message.includes("resolve_annotation_invalid")) return error.hint || "A anotação não passou na conferência do banco.";
  if (error.message.includes("resolve_annotation_note_required")) return "Diga o que precisa mudar (10 caracteres ou mais).";
  return "Não foi possível registrar agora. Tente de novo.";
}

/**
 * Aprova a proposta como está ou com os ajustes do editor. O banco confere de novo e aplica tudo de uma
 * vez (habilidade, assunto, evidência, distratores e resolução); depois disso a questão fica imutável.
 */
export async function approveAnnotation(input: unknown): Promise<ReviewResult> {
  const parsed = z.object({ id, payload: payloadSchema.optional(), note: note.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, problem: "O ajuste está fora do formato esperado. Confira os campos." };
  const { supabase } = await requireEditor();
  const { error } = await supabase.rpc("approve_item_annotation", {
    p_proposal: parsed.data.id,
    p_payload: parsed.data.payload ?? null,
    p_note: parsed.data.note || null,
  });
  return error ? { ok: false, problem: problemOf(error) } : { ok: true };
}

/** Devolve a proposta com o motivo; a questão continua sem anotação até vir outra proposta. */
export async function returnAnnotation(input: unknown): Promise<ReviewResult> {
  const parsed = z.object({ id, note: note.min(10) }).safeParse(input);
  if (!parsed.success) return { ok: false, problem: "Diga o que precisa mudar (10 caracteres ou mais)." };
  const { supabase } = await requireEditor();
  const { error } = await supabase.rpc("return_item_annotation", { p_proposal: parsed.data.id, p_note: parsed.data.note });
  return error ? { ok: false, problem: problemOf(error) } : { ok: true };
}
