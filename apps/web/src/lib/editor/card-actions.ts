"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "./data";
import { textProblem } from "./payload";

export type CardActionResult = { ok: true } | { ok: false; message: string };

const createSchema = z.object({
  area: z.enum(["LC", "MT", "CN", "CH", "RED"]),
  kind: z.enum(["conceito", "formula"]),
  skillCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(H\d{1,2})?$/, "Habilidade no formato H1 a H30, ou em branco."),
  front: z.string().trim().min(3, "Escreva a frente do cartão.").max(600),
  back: z.string().trim().min(1, "Escreva o verso do cartão.").max(2000),
  sourceId: z.string().uuid("Escolha a fonte."),
  locator: z
    .string()
    .trim()
    .min(1, "Informe onde está na fonte (página, seção).")
    .max(200),
});

/** Cria um cartão em rascunho. Fonte e localização são obrigatórias; a habilidade liga o cartão aos erros. */
export async function createCard(input: unknown): Promise<CardActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  const d = parsed.data;
  for (const t of [d.front, d.back, d.locator]) {
    const problem = textProblem(t);
    if (problem) return { ok: false, message: problem };
  }
  const { supabase } = await requireEditor();
  let skillId: string | null = null;
  if (d.skillCode) {
    if (d.area === "RED")
      return {
        ok: false,
        message: "Habilidades da matriz valem para as quatro áreas objetivas.",
      };
    const { data } = await supabase
      .from("skills")
      .select("id, areas!inner(code, matrix_versions!inner(status))")
      .eq("code", d.skillCode)
      .eq("areas.code", d.area)
      .eq("areas.matrix_versions.status", "published")
      .limit(1);
    skillId = (data?.[0] as { id: string } | undefined)?.id ?? null;
    if (!skillId)
      return {
        ok: false,
        message: `Habilidade ${d.skillCode} não encontrada na matriz publicada de ${d.area}.`,
      };
  }
  const { error } = await supabase.from("concept_cards").insert({
    area_code: d.area,
    kind: d.kind,
    skill_id: skillId,
    front: d.front,
    back: d.back,
    source_id: d.sourceId,
    source_locator: d.locator,
  });
  if (error) return { ok: false, message: "Não foi possível criar o cartão." };
  revalidatePath("/editor/cartoes");
  return { ok: true };
}

/** Publica (revisão registrada com a conta do editor) ou aposenta. Publicado não muda. */
export async function setCardStatus(input: unknown): Promise<CardActionResult> {
  const parsed = z
    .object({
      cardId: z.string().uuid(),
      status: z.enum(["publicado", "aposentado"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { supabase } = await requireEditor();
  const from = parsed.data.status === "publicado" ? "rascunho" : "publicado";
  const { data, error } = await supabase
    .from("concept_cards")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.cardId)
    .eq("status", from)
    .select("id");
  if (error || !data?.length)
    return { ok: false, message: "Não foi possível mudar o estado do cartão." };
  revalidatePath("/editor/cartoes");
  return { ok: true };
}

/** Remove um rascunho (publicado não sai). */
export async function deleteCardDraft(
  input: unknown,
): Promise<CardActionResult> {
  const parsed = z.object({ cardId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("concept_cards")
    .delete()
    .eq("id", parsed.data.cardId)
    .eq("status", "rascunho")
    .select("id");
  if (error || !data?.length)
    return { ok: false, message: "Não foi possível remover o rascunho." };
  revalidatePath("/editor/cartoes");
  return { ok: true };
}
