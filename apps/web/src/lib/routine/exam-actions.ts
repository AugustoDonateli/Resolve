"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Data do 1º dia da prova informada pela própria conta (provisória até o edital do Inep).
 * `null` apaga a data e desliga a contagem e a reta final.
 */
export async function setExamDay(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const p = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Data inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para salvar a data." };
  const { error } = await supabase.from("profiles").update({ exam_day1: p.data.date }).eq("user_id", auth.user.id);
  if (error) return { ok: false, message: /check/.test(error.message) ? "Escolha uma data entre 2026 e 2100." : "Não foi possível salvar. Tente de novo." };
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return { ok: true };
}
