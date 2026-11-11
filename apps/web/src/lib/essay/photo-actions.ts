"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Result = { ok: true } | { ok: false; message: string };

/** Guarda a foto da folha manuscrita na pasta pessoal da conta (até 4 fotos por redação). */
export async function uploadEssayPhoto(form: FormData): Promise<Result> {
  const essayId = z.string().uuid().safeParse(form.get("essayId"));
  const file = form.get("file");
  if (!essayId.success || !(file instanceof File)) return { ok: false, message: "Envio inválido." };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, message: "Use uma foto em JPG, PNG ou WebP." };
  if (file.size > MAX_BYTES) return { ok: false, message: "A foto passou de 4 MB mesmo reduzida. Tente outra." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para enviar a foto." };
  // A redação precisa ser da conta (a política de linhas só mostra as próprias).
  const { data: essay } = await supabase.from("essays").select("id").eq("id", essayId.data).maybeSingle();
  if (!essay) return { ok: false, message: "Redação não encontrada." };
  const folder = `${auth.user.id}/redacao/${essay.id}`;
  const { data: existing } = await supabase.storage.from("pessoal").list(folder);
  if ((existing ?? []).length >= 4) return { ok: false, message: "Até 4 fotos por redação." };
  const { error } = await supabase.storage
    .from("pessoal")
    .upload(`${folder}/${Date.now()}.${ext}`, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, message: "Não foi possível enviar a foto. Tente de novo." };
  revalidatePath(`/redacao/escrever/${essay.id}`);
  return { ok: true };
}

/** Remove uma foto da própria pasta (o texto digitado não muda). */
export async function removeEssayPhoto(input: unknown): Promise<Result> {
  const p = z.object({ essayId: z.string().uuid(), path: z.string().max(300) }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para remover." };
  if (!p.data.path.startsWith(`${auth.user.id}/redacao/${p.data.essayId}/`)) return { ok: false, message: "Pedido inválido." };
  const { error } = await supabase.storage.from("pessoal").remove([p.data.path]);
  if (error) return { ok: false, message: "Não foi possível remover. Tente de novo." };
  revalidatePath(`/redacao/escrever/${p.data.essayId}`);
  return { ok: true };
}
