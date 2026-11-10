"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const item = z.object({
  kind: z.enum(["citacao", "dado", "obra", "fato_historico", "conceito", "lei"]),
  content: z.string().trim().min(3, "Escreva o repertório.").max(1200),
  origin: z.string().trim().max(300).optional(),
  source: z.string().trim().min(5, "Informe a fonte: sem fonte, o repertório não entra.").max(500),
  axes: z.array(z.string().trim().min(2).max(60)).max(6),
  use_note: z.string().trim().max(800).optional(),
});

export type RepertoireResult = { ok: true } | { ok: false; message: string };

export async function addRepertoire(input: unknown): Promise<RepertoireResult> {
  const p = item.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.from("repertoire_items").insert({ ...p.data, origin: p.data.origin || null, use_note: p.data.use_note || null });
  if (error) return { ok: false, message: error.code === "23514" ? "Texto com caractere não aceito." : "Não foi possível guardar." };
  revalidatePath("/redacao/repertorio");
  return { ok: true };
}

export async function archiveRepertoire(input: unknown): Promise<RepertoireResult> {
  const p = z.object({ id: z.string().uuid(), archived: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("repertoire_items")
    .update({ archived_at: p.data.archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", p.data.id);
  if (error) return { ok: false, message: "Não foi possível alterar." };
  revalidatePath("/redacao/repertorio");
  return { ok: true };
}
