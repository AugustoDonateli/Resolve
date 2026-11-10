"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "./data";
import { textProblem } from "./payload";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Escolha ao menos uma questão.").max(50, "Publique até 50 questões por vez."),
  note: z.string().trim().min(3, "Descreva o lote publicado.").max(1000),
});

export type PublishResult = { ok: true; published: number } | { ok: false; message: string };

/** Publica o lote numa transação: qualquer impedimento desfaz tudo. */
export async function publishProposals(input: unknown): Promise<PublishResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const problem = textProblem(parsed.data.note);
  if (problem) return { ok: false, message: problem };
  const { supabase } = await requireEditor();
  const { data, error } = await supabase.rpc("publish_proposals", { p_ids: parsed.data.ids, p_note: parsed.data.note });
  if (error) {
    if (error.message.includes("resolve_publication_blocked")) return { ok: false, message: `Nada foi publicado. ${error.hint ?? ""}` };
    return { ok: false, message: "Nada foi publicado: não foi possível concluir a publicação." };
  }
  revalidatePath("/editor");
  revalidatePath("/editor/publicar");
  return { ok: true, published: (data as unknown[]).length };
}

const CONTENT_CHECKLIST = [
  "texto_conferido",
  "sinais_e_formulas",
  "ordem_das_alternativas",
  "figuras_sem_corte",
  "texto_alternativo_sem_resposta",
  "gabarito_oficial",
  "fonte_registrada",
] as const;

const contentSchema = schema.extend({
  checklist: z.record(z.enum(CONTENT_CHECKLIST), z.literal(true)),
});

/**
 * Publica conteúdo oficial conferido, com etiquetas editoriais pendentes (sem habilidade, distratores nem
 * resolução). O editor confirma o checklist de conteúdo; a confirmação fica registrada com a conta dele.
 */
export async function publishConferredContent(input: unknown): Promise<PublishResult> {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confirme todos os itens do checklist." };
  if (CONTENT_CHECKLIST.some((k) => parsed.data.checklist[k] !== true))
    return { ok: false, message: "Confirme todos os itens do checklist." };
  const problem = textProblem(parsed.data.note);
  if (problem) return { ok: false, message: problem };
  const { supabase } = await requireEditor();
  const { data, error } = await supabase.rpc("publish_conferred_content", {
    p_ids: parsed.data.ids,
    p_note: parsed.data.note,
    p_checklist: parsed.data.checklist,
  });
  if (error) {
    if (/resolve_publication_(blocked|checklist)/.test(error.message)) return { ok: false, message: `Nada foi publicado. ${error.hint ?? ""}` };
    return { ok: false, message: "Nada foi publicado: não foi possível concluir a publicação." };
  }
  revalidatePath("/editor");
  revalidatePath("/editor/publicar");
  revalidatePath("/estudar");
  return { ok: true, published: (data as unknown[]).length };
}
