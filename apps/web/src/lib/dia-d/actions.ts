"use server";

import { z } from "zod";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { LETTERS } from "./types";

const start = z.object({
  booklet: z.uuid(),
  language: z.enum(["ingles", "espanhol"]).nullable(),
  action: z.uuid(),
  reference: z.boolean(),
});

export async function startDiaD(input: unknown) {
  const p = start.safeParse(input);
  if (!authEnabled || !p.success) return { error: "Confira o caderno e tente novamente." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dia_d_start", {
    p_booklet: p.data.booklet,
    p_language: p.data.language,
    p_action: p.data.action,
    p_reference: p.data.reference,
  });
  if (!error && typeof data === "string") return { id: data };
  if (error?.message === "dia_d_booklet_unavailable")
    return { error: "O caderno ainda não tem todo o conteúdo publicado." };
  if (error?.message === "dia_d_schedule_unavailable")
    return { error: "O ensaio no horário de referência começa às 13h30 de Brasília. Para começar agora, escolha horário livre." };
  return { error: "Não foi possível começar. Tente novamente." };
}

const save = z.object({
  run: z.uuid(),
  action: z.uuid(),
  revision: z.number().int().nonnegative(),
  kind: z.enum(["abriu", "marcou", "transcreveu", "redacao", "entregou"]),
  position: z.number().int().min(1).max(200).optional(),
  letter: z.enum(LETTERS).nullable().optional(),
  essay: z.string().max(30000).optional(),
});

export async function saveDiaD(input: unknown): Promise<"saved" | "conflict" | "closed" | "error"> {
  const p = save.safeParse(input);
  if (!authEnabled || !p.success) return "error";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dia_d_save", {
    p_run: p.data.run,
    p_action: p.data.action,
    p_revision: p.data.revision,
    p_kind: p.data.kind,
    p_position: p.data.position ?? null,
    p_letter: p.data.letter ?? null,
    p_essay: p.data.essay ?? null,
  });
  return !error && (data === "saved" || data === "conflict" || data === "closed") ? data : "error";
}
