"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "@/lib/editor/data";
import { textProblem } from "@/lib/editor/payload";
import { createClient } from "@/lib/supabase/server";
import { REPORT_KINDS } from "./report-kinds";

/** Ocorrências (F3-T17): o aluno relata; o editor analisa e fecha. Nada aqui altera conteúdo publicado. */
export type ReportResult = { ok: true } | { ok: false; message: string };

const reportSchema = z.object({
  itemVersionId: z.string().uuid(),
  sessionItemId: z.string().uuid().nullable(),
  kind: z.enum(REPORT_KINDS.map((k) => k.code) as [string, ...string[]]),
  message: z
    .string()
    .trim()
    .min(5, "Descreva o problema em poucas palavras.")
    .max(1000),
});

export async function reportProblem(input: unknown): Promise<ReportResult> {
  const p = reportSchema.safeParse(input);
  if (!p.success)
    return {
      ok: false,
      message: p.error.issues[0]?.message ?? "Dados inválidos.",
    };
  const problem = textProblem(p.data.message);
  if (problem) return { ok: false, message: problem };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para relatar." };
  const { error } = await supabase.from("item_reports").insert({
    item_version_id: p.data.itemVersionId,
    session_item_id: p.data.sessionItemId,
    kind: p.data.kind,
    message: p.data.message,
  });
  if (error)
    return {
      ok: false,
      message: "Não foi possível enviar o relato. Tente de novo.",
    };
  revalidatePath("/editor/ocorrencias");
  return { ok: true };
}

export async function handleReport(input: unknown): Promise<ReportResult> {
  const p = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["em_analise", "resolvida", "descartada"]),
      note: z.string().trim().max(1000).default(""),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Dados inválidos." };
  if (p.data.note) {
    const problem = textProblem(p.data.note);
    if (problem) return { ok: false, message: problem };
  }
  const { supabase } = await requireEditor();
  const { error, data } = await supabase
    .from("item_reports")
    .update({ status: p.data.status, editor_note: p.data.note || null })
    .eq("id", p.data.id)
    .select("id");
  if (error || !data?.length)
    return { ok: false, message: "Não foi possível atualizar a ocorrência." };
  revalidatePath("/editor/ocorrencias");
  return { ok: true };
}
