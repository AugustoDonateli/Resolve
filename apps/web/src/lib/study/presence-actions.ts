"use server";

import { z } from "zod";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Aviso de presença numa página de estudo. Falha em silêncio: é só contagem de tempo. */
export async function pingStudy(input: unknown): Promise<void> {
  if (!authEnabled) return;
  const p = z.enum(["questoes", "revisao", "redacao", "simulado", "diagnostico"]).safeParse(input);
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.rpc("ping_study", { p_kind: p.data });
}
