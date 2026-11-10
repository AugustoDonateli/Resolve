import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ModelConfig } from "./engine";

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
  const [{ data: models }, { data: items }] = await Promise.all([
    supabase
      .from("tri_model_versions")
      .select("id, validation_status, prior_config, integration_config, transform_config, interval_z, transform_source, created_at, parameter_sets!inner(label, scale_constant, areas!inner(code))")
      .neq("validation_status", "reprovado")
      .order("created_at", { ascending: false }),
    supabase.from("study_items").select("area").eq("annulled", false),
  ]);
  type M = {
    id: string;
    validation_status: string;
    prior_config: { kind: "normal"; mean: number; sd: number };
    integration_config: { from: number; to: number; points: number };
    transform_config: { slope: number; intercept: number } | null;
    interval_z: number;
    transform_source: string | null;
    parameter_sets: { label: string; scale_constant: number; areas: { code: string } };
  };
  const byArea = new Map<string, M>();
  for (const m of (models ?? []) as unknown as M[]) if (!byArea.has(m.parameter_sets.areas.code)) byArea.set(m.parameter_sets.areas.code, m);
  return Promise.all(
    AREAS.map(async (area) => {
      const m = byArea.get(area.code) ?? null;
      const { data: rows } = await supabase.rpc("tri_responses", { p_area: area.code, p_model: m?.id ?? "" });
      const r = (rows ?? []) as { item_id: string; is_correct: boolean; a: number | null; b: number | null; c: number | null; valid: boolean }[];
      const data = r
        .filter((x) => x.valid && x.a !== null && x.b !== null && x.c !== null)
        .map((x) => ({ itemId: x.item_id, correct: x.is_correct, a: Number(x.a), b: Number(x.b), c: Number(x.c) }));
      const reason: AreaDiagnostic["reason"] = !m ? "sem_modelo" : data.length === 0 ? "sem_parametros" : data.length < MIN_ITEMS_FOR_ESTIMATE ? "poucas_respostas" : null;
      return {
        code: area.code,
        label: area.label,
        responses: r.length,
        correct: r.filter((x) => x.is_correct).length,
        withParameters: data.length,
        publishedItems: (items ?? []).filter((i) => i.area === area.code).length,
        model: m
          ? {
              id: m.id,
              status: m.validation_status,
              parameterSet: m.parameter_sets.label,
              transformSource: m.transform_source,
              config: {
                D: Number(m.parameter_sets.scale_constant),
                prior: { kind: "normal", mean: Number(m.prior_config.mean), sd: Number(m.prior_config.sd) },
                quadrature: { from: Number(m.integration_config.from), to: Number(m.integration_config.to), points: Number(m.integration_config.points) },
                transform: m.transform_config ? { slope: Number(m.transform_config.slope), intercept: Number(m.transform_config.intercept) } : null,
                intervalZ: Number(m.interval_z),
              },
            }
          : null,
        data,
        reason,
      };
    }),
  );
}
