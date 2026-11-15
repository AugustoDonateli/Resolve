import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ItemParameters, ModelConfig } from "./engine";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface AreaModel {
  id: string;
  status: string;
  parameterSet: string;
  config: ModelConfig;
  transformSource: string | null;
  validationNote: string | null;
  /** Conjunto principal e os demais ligados ao modelo (edições na mesma escala). */
  setIds: string[];
}

/**
 * Versão mais recente do modelo de TRI de cada área (as reprovadas ficam fora), com todos os conjuntos de
 * parâmetros ligados a ela. Sem modelo registrado, a área não aparece no mapa: quem exibe diz "indisponível".
 */
export async function loadAreaModels(supabase: Client): Promise<Map<string, AreaModel>> {
  const [{ data: models, error }, { data: extras, error: extrasError }] = await Promise.all([
    supabase
      .from("tri_model_versions")
      .select("id, validation_status, validation_note, prior_config, integration_config, transform_config, interval_z, transform_source, created_at, parameter_set_id, parameter_sets!tri_model_versions_parameter_set_id_fkey!inner(label, scale_constant, areas!inner(code))")
      .neq("validation_status", "reprovado")
      .order("created_at", { ascending: false }),
    supabase.from("tri_model_parameter_sets").select("model_id, parameter_set_id"),
  ]);
  // erro de consulta não pode virar "sem modelo": isso diria ao aluno que não há parâmetros quando há
  if (error || extrasError) throw new Error(`modelos de TRI: ${(error ?? extrasError)!.message}`);
  type M = {
    id: string;
    validation_status: string;
    validation_note: string | null;
    prior_config: { kind: "normal"; mean: number; sd: number };
    integration_config: { from: number; to: number; points: number };
    transform_config: { slope: number; intercept: number } | null;
    interval_z: number;
    transform_source: string | null;
    parameter_set_id: string;
    parameter_sets: { label: string; scale_constant: number; areas: { code: string } };
  };
  const more = new Map<string, string[]>();
  for (const e of (extras ?? []) as { model_id: string; parameter_set_id: string }[]) {
    more.set(e.model_id, [...(more.get(e.model_id) ?? []), e.parameter_set_id]);
  }
  const byArea = new Map<string, AreaModel>();
  for (const m of (models ?? []) as unknown as M[]) {
    const area = m.parameter_sets.areas.code;
    if (byArea.has(area)) continue;
    byArea.set(area, {
      id: m.id,
      status: m.validation_status,
      parameterSet: m.parameter_sets.label,
      transformSource: m.transform_source,
      validationNote: m.validation_note,
      setIds: [m.parameter_set_id, ...(more.get(m.id) ?? [])],
      config: {
        D: Number(m.parameter_sets.scale_constant),
        prior: { kind: "normal", mean: Number(m.prior_config.mean), sd: Number(m.prior_config.sd) },
        quadrature: { from: Number(m.integration_config.from), to: Number(m.integration_config.to), points: Number(m.integration_config.points) },
        transform: m.transform_config ? { slope: Number(m.transform_config.slope), intercept: Number(m.transform_config.intercept) } : null,
        intervalZ: Number(m.interval_z),
      },
    });
  }
  return byArea;
}

/** Parâmetros dos itens pedidos nos conjuntos do modelo; item sem parâmetro válido fica como null. */
export async function loadItemParameters(supabase: Client, model: AreaModel, itemIds: string[]): Promise<Map<string, ItemParameters | null>> {
  const out = new Map<string, ItemParameters | null>();
  if (itemIds.length === 0) return out;
  const { data, error } = await supabase
    .from("item_parameters")
    .select("item_id, a, b, c, valid")
    .in("parameter_set_id", model.setIds)
    .in("item_id", itemIds);
  if (error) throw new Error(`parâmetros de TRI: ${error.message}`);
  for (const r of (data ?? []) as { item_id: string; a: number | null; b: number | null; c: number | null; valid: boolean }[]) {
    if (r.valid && r.a !== null && r.b !== null && r.c !== null) out.set(r.item_id, { a: Number(r.a), b: Number(r.b), c: Number(r.c) });
    else if (!out.has(r.item_id)) out.set(r.item_id, null);
  }
  return out;
}
