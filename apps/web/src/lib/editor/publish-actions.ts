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
