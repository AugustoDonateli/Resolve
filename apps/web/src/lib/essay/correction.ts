import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CorrectionAnnotation {
  id: string;
  competency: string;
  intervention_element: string | null;
  absent: boolean;
  paragraph_id: string | null;
  start_utf16: number | null;
  end_utf16: number | null;
  comment: string;
}

export interface CorrectionEvaluation {
  id: string;
  slot: "A" | "B" | "C";
  scores: Record<string, number>;
  total: number;
  feedback: string | null;
  intervention: Record<string, string | null> | null;
  model: string;
  promptVersion: string;
  /** Avaliação produzida pelo avaliador de teste da integração: nunca é correção real. */
  isTest: boolean;
  annotations: CorrectionAnnotation[];
}

export interface CorrectionView {
  essayId: string;
  promptTitle: string | null;
  paragraphs: { id: string; text: string }[];
  submittedAt: string | null;
  job: { id: string; status: string; step: string; attempts: number; maxAttempts: number; autoRetry: boolean } | null;
  evaluations: CorrectionEvaluation[];
  result: {
    lower: number;
    upper: number;
    center: number | null;
    count: number | null;
    discrepancy: boolean | null;
    status: "nao_calibrado" | "calibrado";
    calibratedLower: number | null;
    calibratedUpper: number | null;
    rule: string;
  } | null;
  rule: { version: string; totalGt: number; competencyGt: number; sourceNote: string } | null;
  dimensions: { code: string; title: string }[];
}

const isTestModel = (model: string, prompt: string) => model.startsWith("avaliador-de-teste") || prompt.startsWith("teste");

/** Correção da versão enviada mais recente da redação (só da própria conta, pelas políticas de acesso). */
export async function loadCorrection(essayId: string): Promise<CorrectionView> {
  if (!/^[0-9a-f-]{36}$/.test(essayId)) notFound();
  const supabase = await createClient();
  const { data: essay } = await supabase.from("essays").select("id, essay_prompts(title)").eq("id", essayId).maybeSingle();
  if (!essay) notFound();
  const { data: v } = await supabase
    .from("essay_versions")
    .select("id, paragraphs_json, submitted_at")
    .eq("essay_id", essayId)
    .eq("status", "submetida")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const [{ data: dims }, { data: rule }] = await Promise.all([
    supabase.from("rubric_dimensions").select("code, title, position, essay_rubrics!inner(version)").eq("essay_rubrics.version", "enem-redacao-v1").order("position"),
    supabase.from("essay_aggregation_rules").select("version, total_gt, competency_gt, source_note").eq("status", "ativa").maybeSingle(),
  ]);
  const base = {
    essayId,
    promptTitle: (essay.essay_prompts as unknown as { title: string } | null)?.title ?? null,
    paragraphs: ((v?.paragraphs_json ?? []) as { id: string; text: string }[]),
    submittedAt: v?.submitted_at ?? null,
    rule: rule ? { version: rule.version, totalGt: rule.total_gt, competencyGt: rule.competency_gt, sourceNote: rule.source_note } : null,
    dimensions: (dims ?? []).map((d) => ({ code: d.code, title: d.title })),
  };
  if (!v) return { ...base, job: null, evaluations: [], result: null };
  const { data: job } = await supabase
    .from("essay_jobs")
    .select("id, status, step, attempts, max_attempts, auto_retry")
    .eq("version_id", v.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!job) return { ...base, job: null, evaluations: [], result: null };
  const [{ data: evals }, { data: result }] = await Promise.all([
    supabase
      .from("essay_evaluations")
      .select("id, evaluator_slot, scores, total, feedback, intervention, model_id, prompt_version, essay_annotations(id, competency, intervention_element, absent, paragraph_id, start_utf16, end_utf16, comment)")
      .eq("job_id", job.id)
      .order("evaluator_slot"),
    supabase.from("essay_results").select("*").eq("job_id", job.id).maybeSingle(),
  ]);
  return {
    ...base,
    job: { id: job.id, status: job.status, step: job.step, attempts: job.attempts, maxAttempts: job.max_attempts, autoRetry: job.auto_retry },
    evaluations: (evals ?? []).map((e) => ({
      id: e.id,
      slot: e.evaluator_slot as "A" | "B" | "C",
      scores: e.scores as Record<string, number>,
      total: e.total,
      feedback: e.feedback,
      intervention: e.intervention as Record<string, string | null> | null,
      model: e.model_id,
      promptVersion: e.prompt_version,
      isTest: isTestModel(e.model_id, e.prompt_version),
      annotations: (e.essay_annotations ?? []) as CorrectionAnnotation[],
    })),
    result: result
      ? {
          lower: result.evaluator_lower,
          upper: result.evaluator_upper,
          center: result.center,
          count: result.evaluator_count,
          discrepancy: result.discrepancy,
          status: result.status,
          calibratedLower: result.calibrated_lower,
          calibratedUpper: result.calibrated_upper,
          rule: result.aggregation_version,
        }
      : null,
  };
}
