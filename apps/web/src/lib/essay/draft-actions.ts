"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fromParagraphs, toParagraphs } from "./draft";
import { SHEET_PROFILE, wrapLines } from "./sheet";

/**
 * Rascunho de redação (F5-T05). Gravar exige a revisão que o cliente viu; se outra aba/aparelho gravou
 * antes, nada é sobrescrito: a resposta traz a versão do servidor para o aluno escolher.
 */
export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: { text: string; revision: number } }
  | { ok: false; error: string };

const BAD_TEXT = /[\x01-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮⁦-⁩‎‏]/;

export async function saveDraft(input: unknown): Promise<SaveResult> {
  const p = z
    .object({
      versionId: z.string().uuid(),
      expectedRevision: z.number().int().min(0),
      text: z.string().max(20000),
    })
    .safeParse(input);
  if (!p.success)
    return { ok: false, error: "Texto grande demais ou inválido." };
  if (BAD_TEXT.test(p.data.text))
    return {
      ok: false,
      error: "O texto tem um caractere invisível que não é aceito.",
    };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Entre para salvar." };
  const { data: profile } = await supabase
    .from("essay_layout_profiles")
    .select("id")
    .eq("version", SHEET_PROFILE.version)
    .maybeSingle();
  const profileId = profile?.id ?? null;
  const { data, error } = await supabase
    .from("essay_versions")
    .update({
      paragraphs_json: toParagraphs(p.data.text),
      // Contagem reproduzível da folha simulada (F5-T06), calculada com o perfil fixo.
      layout_profile_id: profileId,
      simulated_lines: Math.min(200, wrapLines(p.data.text).length),
    })
    .eq("id", p.data.versionId)
    .eq("revision", p.data.expectedRevision)
    .eq("status", "rascunho")
    .select("revision");
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  if (data?.length) return { ok: true, revision: data[0]!.revision };
  const { data: current } = await supabase
    .from("essay_versions")
    .select("revision, status, paragraphs_json")
    .eq("id", p.data.versionId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Rascunho não encontrado." };
  if (current.status !== "rascunho")
    return { ok: false, error: "Esta versão já foi enviada e não muda mais." };
  return {
    ok: false,
    conflict: {
      text: fromParagraphs(
        (current.paragraphs_json ?? []) as { text: string }[],
      ),
      revision: current.revision,
    },
  };
}

/** Nova redação (com tema publicado opcional) e o primeiro rascunho vazio. Devolve o id da redação. */
export async function createEssay(
  input: unknown,
): Promise<{ ok: true; essayId: string } | { ok: false; error: string }> {
  const p = z
    .object({ promptId: z.string().uuid().nullable() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Entre para escrever." };
  const { data: essay, error } = await supabase
    .from("essays")
    .insert({ prompt_id: p.data.promptId })
    .select("id")
    .single();
  if (error || !essay)
    return { ok: false, error: "Não foi possível criar a redação." };
  const v = await supabase
    .from("essay_versions")
    .insert({ essay_id: essay.id, paragraphs_json: [] });
  if (v.error)
    return { ok: false, error: "Não foi possível criar o rascunho." };
  return { ok: true, essayId: essay.id };
}
