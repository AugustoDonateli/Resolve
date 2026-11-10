import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Taxon } from "@/components/skills/skill-runner";

/** Tipos de distrator para o aluno escolher (sem "não classificado", que é decisão editorial). */
export async function loadTaxonomy(): Promise<Taxon[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("distractor_types")
    .select("code, label, definition")
    .eq("taxonomy_version", "v0-proposta")
    .neq("code", "nao_classificado")
    .order("label");
  return (data ?? []) as Taxon[];
}
