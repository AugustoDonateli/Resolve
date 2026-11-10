"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult = { ok: true; essayId: string; status: string } | { ok: false; message: string };

const schema = z.object({
  essayId: z.string().uuid(),
  versionId: z.string().uuid(),
  key: z.string().regex(/^[A-Za-z0-9_-]{8,120}$/),
});

/** Avisa o serviço de correção (Edge Function) que há trabalho; não espera a correção terminar. */
async function nudgeWorker(accessToken: string | undefined) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !accessToken) return;
  try {
    await fetch(`${url}/functions/v1/corrigir-redacao`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // sem resposta rápida: o trabalho continua na fila e é pego na próxima chamada
  }
}

/**
 * Envia a versão salva para correção: o banco congela a versão (não muda mais), cria um trabalho por
 * versão e reserva a primeira etapa no orçamento. A mesma chave devolve o trabalho existente.
 */
export async function submitForCorrection(input: unknown): Promise<SubmitResult> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, message: "Envio inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_essay", { p_version_id: p.data.versionId, p_idempotency_key: p.data.key });
  if (error) {
    if (/essay_text|resolve_essay_not_found/.test(error.message)) return { ok: false, message: "Não foi possível enviar esta versão." };
    if (/resolve_no_model_policy/.test(error.message)) return { ok: false, message: "A correção ainda não está configurada." };
    return { ok: false, message: "Não foi possível enviar agora. Tente de novo." };
  }
  const row = (data as { status: string }[] | null)?.[0];
  const { data: session } = await supabase.auth.getSession();
  await nudgeWorker(session.session?.access_token);
  revalidatePath("/redacao/minhas");
  return { ok: true, essayId: p.data.essayId, status: row?.status ?? "na_fila" };
}

/** Pede de novo uma correção parada (limite atingido ou falhas seguidas). */
export async function retryCorrection(input: unknown): Promise<SubmitResult> {
  const p = z.object({ essayId: z.string().uuid(), jobId: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retry_essay_job", { p_job_id: p.data.jobId });
  if (error) return { ok: false, message: "Não foi possível pedir de novo." };
  const { data: session } = await supabase.auth.getSession();
  await nudgeWorker(session.session?.access_token);
  revalidatePath(`/redacao/correcao/${p.data.essayId}`);
  return { ok: true, essayId: p.data.essayId, status: (data as { status: string }[] | null)?.[0]?.status ?? "na_fila" };
}

/**
 * Reescrita: cria uma versão nova (rascunho) a partir da última enviada, com o mesmo texto, ligada a ela
 * por parent_id. A versão enviada e a correção dela continuam intactas. Se já houver uma reescrita em
 * rascunho, abre essa.
 */
export async function startRewrite(input: unknown): Promise<{ ok: true; essayId: string } | { ok: false; message: string }> {
  const p = z.object({ essayId: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("essay_versions")
    .select("id, status, paragraphs_json")
    .eq("essay_id", p.data.essayId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return { ok: false, message: "Redação não encontrada." };
  if (latest.status === "rascunho") return { ok: true, essayId: p.data.essayId };
  const { error } = await supabase
    .from("essay_versions")
    .insert({ essay_id: p.data.essayId, parent_id: latest.id, paragraphs_json: latest.paragraphs_json });
  if (error) return { ok: false, message: "Não foi possível começar a reescrita." };
  revalidatePath("/redacao/minhas");
  return { ok: true, essayId: p.data.essayId };
}
