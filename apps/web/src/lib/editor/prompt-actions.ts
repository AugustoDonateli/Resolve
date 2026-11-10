"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "./data";
import { textProblem } from "./payload";

export type PromptActionResult = { ok: true } | { ok: false; message: string };

const uuid = z.string().uuid();

function refresh(promptId: string) {
  revalidatePath("/editor/temas");
  revalidatePath(`/editor/temas/${promptId}`);
  revalidatePath("/redacao/temas");
}

/** Marca (ou desmarca) um texto motivador como conferido com o caderno. O banco grava quem e quando. */
export async function setTextVerified(input: unknown): Promise<PromptActionResult> {
  const parsed = z.object({ promptId: uuid, textId: uuid, verified: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("motivating_texts")
    .update({ rights_status: parsed.data.verified ? "verificado" : "pendente" })
    .eq("id", parsed.data.textId)
    .eq("prompt_id", parsed.data.promptId)
    .select("id");
  if (error) {
    if (error.message.includes("resolve_prompt_published_immutable")) return { ok: false, message: "Tema publicado não muda." };
    return { ok: false, message: "Não foi possível gravar a conferência." };
  }
  if (!data?.length) return { ok: false, message: "Texto não encontrado." };
  refresh(parsed.data.promptId);
  return { ok: true };
}

/** Corrige o texto alternativo de uma figura. Mudar o conteúdo devolve o texto para "pendente" (banco). */
export async function setFigureAlt(input: unknown): Promise<PromptActionResult> {
  const parsed = z
    .object({ promptId: uuid, textId: uuid, blockId: z.string().regex(/^[a-z0-9_-]{1,24}$/), alt: z.string().trim().min(10, "Descreva a figura em pelo menos 10 caracteres.").max(1000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const problem = textProblem(parsed.data.alt);
  if (problem) return { ok: false, message: problem };
  const { supabase } = await requireEditor();
  const { data: row } = await supabase.from("motivating_texts").select("blocks").eq("id", parsed.data.textId).eq("prompt_id", parsed.data.promptId).single();
  if (!row) return { ok: false, message: "Texto não encontrado." };
  const blocks = (row.blocks as { id: string; type: string; text?: string }[]).map((b) =>
    b.id === parsed.data.blockId && b.type === "image" ? { ...b, text: parsed.data.alt } : b,
  );
  if (!blocks.some((b) => b.id === parsed.data.blockId && b.type === "image")) return { ok: false, message: "Figura não encontrada." };
  const { error } = await supabase.from("motivating_texts").update({ blocks }).eq("id", parsed.data.textId);
  if (error) return { ok: false, message: error.message.includes("resolve_prompt_published_immutable") ? "Tema publicado não muda." : "Não foi possível gravar." };
  refresh(parsed.data.promptId);
  return { ok: true };
}

/** Publica o tema. O banco recusa se houver impedimento (texto não conferido, figura sem arquivo etc.). */
export async function publishPrompt(input: unknown): Promise<PromptActionResult> {
  const parsed = z.object({ promptId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("essay_prompts").update({ status: "published" }).eq("id", parsed.data.promptId).eq("status", "draft");
  if (error) {
    if (error.message.includes("resolve_prompt_sources_unverified")) return { ok: false, message: `Tema não publicado: ${error.details ?? "há impedimentos."}` };
    return { ok: false, message: "Tema não publicado: não foi possível concluir." };
  }
  refresh(parsed.data.promptId);
  return { ok: true };
}
