import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ModelConfig } from "./engine";
import { loadAreaModels } from "./models";

/** Regra da plataforma: abaixo disso a estimativa não é mostrada ("dados insuficientes"). */
export const MIN_ITEMS_FOR_ESTIMATE = 10;

export const AREAS: { code: "LC" | "CH" | "CN" | "MT"; label: string }[] = [
  { code: "LC", label: "Linguagens" },
  { code: "CH", label: "Ciências Humanas" },
  { code: "CN", label: "Ciências da Natureza" },
  { code: "MT", label: "Matemática" },
];

export interface AreaDiagnostic {
  code: string;
  label: string;
  responses: number;
  correct: number;
  withParameters: number;
  publishedItems: number;
  model: {
    id: string;
    status: string;
    parameterSet: string;
    config: ModelConfig;
    transformSource: string | null;
    validationNote: string | null;
  } | null;
  /** Respostas com parâmetro válido, prontas para o motor (o cálculo e os cenários rodam na tela). */
  data: { itemId: string; correct: boolean; a: number; b: number; c: number }[];
  reason: "sem_modelo" | "sem_parametros" | "poucas_respostas" | null;
}

/**
 * Diagnóstico por área: respostas que entram na TRI (primeira tentativa, sem ajuda, sem repetição) e a
 * versão do modelo registrada para a área. Sem conjunto de parâmetros com fonte, não há estimativa.
 */
export async function loadDiagnostic(): Promise<AreaDiagnostic[] | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [byArea, { data: items }] = await Promise.all([
    loadAreaModels(supabase),
    supabase.from("study_items").select("area").eq("annulled", false),
  ]);
  return Promise.all(
    AREAS.map(async (area) => {
      const m = byArea.get(area.code) ?? null;
      const { data: rows } = await supabase.rpc("tri_responses", { p_area: area.code, p_model: m?.id ?? "" });
      const r = (rows ?? []) as { item_id: string; is_correct: boolean; a: number | null; b: number | null; c: number | null; valid: boolean }[];
      const usable = r.filter((x) => x.valid && x.a !== null && x.b !== null && x.c !== null);
      const labels = await itemLabels(supabase, usable.map((x) => x.item_id));
      const data = usable.map((x) => ({
        itemId: x.item_id, correct: x.is_correct, a: Number(x.a), b: Number(x.b), c: Number(x.c), label: labels.get(x.item_id),
      }));
      const reason: AreaDiagnostic["reason"] = !m ? "sem_modelo" : data.length === 0 ? "sem_parametros" : data.length < MIN_ITEMS_FOR_ESTIMATE ? "poucas_respostas" : null;
      return {
        code: area.code,
        label: area.label,
        responses: r.length,
        correct: r.filter((x) => x.is_correct).length,
        withParameters: data.length,
        publishedItems: (items ?? []).filter((i) => i.area === area.code).length,
        model: m
          ? { id: m.id, status: m.status, parameterSet: m.parameterSet, transformSource: m.transformSource, validationNote: m.validationNote, config: m.config }
          : null,
        data,
        reason,
      };
    }),
  );
}

/** "Enem 2024 · questão 47": ano e posição no caderno azul (primeira aparição listada). */
async function itemLabels(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from("study_items").select("item_id, appearances").in("item_id", ids);
  for (const row of (data ?? []) as { item_id: string; appearances: { year?: number; position: number }[] | null }[]) {
    const ap = row.appearances?.[0];
    if (ap) out.set(row.item_id, `${ap.year ? `Enem ${ap.year} · ` : ""}questão ${ap.position}`);
  }
  return out;
}
