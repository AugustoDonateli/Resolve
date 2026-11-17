import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadQuestionAssets } from "@/lib/study/question-assets";
import { fromStudyItem, type StudyItemRow, type StudyQuestion } from "@/lib/study/question-types";
import type { Lesson, QuestionCode } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Questão publicada pelo código "ano-posição" do caderno azul (sem língua estrangeira). */
async function rowByCode(supabase: Client, code: QuestionCode): Promise<StudyItemRow | null> {
  const [year, position] = code.split("-").map(Number);
  const { data } = await supabase
    .from("study_items")
    .select("item_version_id, area, stimulus_blocks, command_blocks, alternatives, appearances, stimulus_version_id")
    // Lista de objetos em jsonb vai como texto JSON: com um array, o cliente montaria um literal de array do Postgres.
    .contains("appearances", JSON.stringify([{ year, position, color: "Azul" }]))
    .is("foreign_language", null)
    .eq("annulled", false)
    .limit(1);
  return ((data ?? [])[0] as StudyItemRow | undefined) ?? null;
}

export async function itemVersionIds(codes: QuestionCode[]): Promise<string[]> {
  const supabase = await createClient();
  const rows = await Promise.all(codes.map((c) => rowByCode(supabase, c)));
  return rows.flatMap((r) => (r ? [r.item_version_id] : []));
}

export type Verdict = "entendi" | "confuso" | "chato";
export type Section = "entrada" | "explicacao" | "exemplo" | "lacunas" | "treino" | "pegadinhas" | "cartoes";

export interface LessonPage {
  questions: Partial<Record<QuestionCode, StudyQuestion>>;
  feedback: Partial<Record<Section, { verdict: Verdict; note: string | null }>>;
  bankHref: string | null;
}

/** As questões reais da lição (exemplos), as marcações da conta e o link do banco filtrado pelo assunto. */
export async function loadLessonPage(lesson: Lesson): Promise<LessonPage> {
  if (!authEnabled) return { questions: {}, feedback: {}, bankHref: null };
  const supabase = await createClient();
  const codes = [lesson.worked.q, lesson.gapped.q];
  const [rows, fb, subject] = await Promise.all([
    Promise.all(codes.map((c) => rowByCode(supabase, c))),
    supabase.from("lesson_feedback").select("section, verdict, note").eq("lesson_slug", lesson.slug),
    supabase.from("subjects").select("id").eq("code", lesson.subjectCode).maybeSingle(),
  ]);
  const found = rows.filter((r): r is StudyItemRow => r !== null);
  const assets = await loadQuestionAssets(supabase, found);
  const questions: LessonPage["questions"] = {};
  codes.forEach((c, i) => {
    const r = rows[i];
    if (r) questions[c] = fromStudyItem(r, assets);
  });
  const feedback: LessonPage["feedback"] = {};
  for (const f of (fb.data ?? []) as { section: Section; verdict: Verdict; note: string | null }[]) feedback[f.section] = { verdict: f.verdict, note: f.note };
  return { questions, feedback, bankHref: subject.data ? `/estudar/banco?assunto=${subject.data.id}` : null };
}
