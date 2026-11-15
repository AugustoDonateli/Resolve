import "server-only";
import { notFound } from "next/navigation";
import { loadPrompt } from "@/lib/essay/prompts";
import { loadQuestionAssets } from "@/lib/study/question-assets";
import { AREA_LABEL, fromStudyItem, type StudyItemRow } from "@/lib/study/question-types";
import { scoreExam, type ExamAreaInput } from "@/lib/tri/exam";
import { loadAreaModels, loadItemParameters } from "@/lib/tri/models";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { LETTERS, type Catalog, type ExamRun } from "./types";

export async function loadCatalog(): Promise<Catalog | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dia_d_catalog");
  return error ? null : (data as Catalog);
}

export async function loadExamRun(id: string): Promise<ExamRun> {
  if (!authEnabled || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dia_d_read", { p_run: id });
  if (error) throw new Error("Não foi possível carregar o Dia D.");
  if (!data) notFound();
  const run = data as ExamRun;
  const loadedAt = Date.now();
  const seconds = Math.max(3600, Math.ceil((Date.parse(run.deadline_at) - Date.parse(run.server_time)) / 1000) + 300);
  const [{ data: study, error: studyError }, prompt] = await Promise.all([
    supabase.from("study_items")
      .select("item_version_id, item_id, area, stimulus_blocks, command_blocks, alternatives, appearances")
      .in("item_version_id", run.items.flatMap((item) => item.version ? [item.version] : [])),
    run.prompt_id ? loadPrompt(supabase, run.prompt_id, seconds) : null,
  ]);
  if (studyError) throw new Error("Não foi possível carregar as questões do Dia D.");
  const rows = (study ?? []) as (StudyItemRow & { item_id: string })[];
  const assets = await loadQuestionAssets(supabase, rows, seconds);
  const questions = new Map(rows.map((row) => [row.item_version_id, fromStudyItem(row, assets)]));
  const tri = run.ended_at ? await examScores(supabase, run, rows) : undefined;
  return {
    ...run,
    tri,
    server_time: new Date(Date.parse(run.server_time) + Date.now() - loadedAt).toISOString(),
    prompt,
    items: run.items.map((item) => {
      const question = item.version ? questions.get(item.version) : undefined;
      const { letters } = item;
      if (!question || !letters) return item;
      const alternatives = LETTERS.flatMap((letter) => {
        const alternative = question.alternatives.find((a) => a.key === letters[letter]);
        return alternative ? [{ ...alternative, letter, key: letter }] : [];
      });
      return {
        ...item,
        question: {
          ...question,
          alternatives,
          origin: `${run.booklet.profile} · Caderno ${run.booklet.number} (${run.booklet.color}) · Questão ${item.position}`,
        },
      };
    }),
  };
}

const AREA_ORDER = ["LC", "CH", "CN", "MT"] as const;

/** Nota TRI por área da prova entregue: o que ficou no cartão contra o gabarito, com o modelo de cada área. */
async function examScores(supabase: Awaited<ReturnType<typeof createClient>>, run: ExamRun, rows: (StudyItemRow & { item_id: string })[]) {
  const byVersion = new Map(rows.map((r) => [r.item_version_id, r]));
  const byArea = new Map<string, ExamAreaInput["items"]>();
  for (const item of run.items) {
    const row = item.version && !item.annulled ? byVersion.get(item.version) : undefined;
    if (!row) continue;
    const list = byArea.get(row.area) ?? [];
    list.push({ itemId: row.item_id, correct: !!item.card && item.card === item.correct, blank: !item.card });
    byArea.set(row.area, list);
  }
  const models = await loadAreaModels(supabase);
  const params = new Map();
  for (const [area, items] of byArea) {
    const model = models.get(area);
    if (model) for (const [k, v] of await loadItemParameters(supabase, model, items.map((i) => i.itemId))) params.set(k, v);
  }
  const areas = AREA_ORDER.filter((a) => byArea.has(a)).map((a) => ({ area: a, label: AREA_LABEL[a], items: byArea.get(a)! }));
  return scoreExam(areas, models, params);
}
