import "server-only";
import { loadQuestionAssets } from "@/lib/study/question-assets";
import { fromStudyItem, type StudyItemRow } from "@/lib/study/question-types";
import { requireEditor } from "./data";
import {
  payloadSchema,
  type AnnotationReview,
  type AreaCode,
  type QueueRow,
  type ReviewOptions,
  type SubjectOption,
} from "./annotation-types";

type Editor = Awaited<ReturnType<typeof requireEditor>>["supabase"];

/** Fila da conferência: a proposta mais recente de cada questão, na ordem do caderno. */
export async function loadAnnotationQueue(supabase: Editor): Promise<QueueRow[]> {
  const { data, error } = await supabase.rpc("annotation_review_queue");
  if (error) throw new Error(`fila de anotações: ${error.message}`);
  return ((data ?? []) as { proposal_id: string; status: QueueRow["status"]; area: AreaCode; year: number; position: number; language: QueueRow["language"]; flagged: boolean }[]).map(
    (r) => ({ id: r.proposal_id, status: r.status, area: r.area, year: r.year, position: r.position, language: r.language, flagged: r.flagged }),
  );
}

interface RawReview {
  id: string;
  status: AnnotationReview["status"];
  review_note: string | null;
  item_version_id: string;
  area: AreaCode;
  year: number;
  position: number;
  day: number;
  booklet: number;
  color: string;
  language: AnnotationReview["language"];
  stimulus_blocks: StudyItemRow["stimulus_blocks"];
  command_blocks: StudyItemRow["command_blocks"];
  alternatives: { key: string; content_blocks: StudyItemRow["command_blocks"]; is_correct: boolean }[] | null;
  payload: unknown;
  skill: { code: string; description: string } | null;
  skill_secondary: { code: string; description: string } | null;
  subject: { code: string; label: string; kind: string; parent: string | null; grandparent: string | null } | null;
  stats: { edition: number; respondents: number; correct: number; blank: number; alternatives: Record<string, number> | null; alternatives_respondents: number | null } | null;
}

/** Uma proposta com a questão como o aluno vê, o gabarito e as marcações reais. Null se não existir. */
export async function loadAnnotation(supabase: Editor, id: string): Promise<AnnotationReview | null> {
  const { data, error } = await supabase.rpc("annotation_review", { p_proposal: id });
  if (error) throw new Error(`anotação: ${error.message}`);
  const raw = data as RawReview | null;
  if (!raw) return null;
  const payload = payloadSchema.safeParse(raw.payload);
  if (!payload.success) throw new Error(`anotação ${id} fora do formato anotacao/v1`);
  const alternatives = raw.alternatives ?? [];
  const row: StudyItemRow = {
    item_version_id: raw.item_version_id,
    area: raw.area,
    stimulus_blocks: raw.stimulus_blocks,
    command_blocks: raw.command_blocks,
    alternatives: alternatives.map((a) => ({ key: a.key, content_blocks: a.content_blocks })),
    appearances: [{ year: raw.year, booklet: raw.booklet, day: raw.day, color: raw.color, position: raw.position }],
  };
  const assets = await loadQuestionAssets(supabase, [row]);
  const st = raw.stats;
  const marked = st?.alternatives && st.alternatives_respondents ? st.alternatives : null;
  return {
    id: raw.id,
    status: raw.status,
    reviewNote: raw.review_note,
    area: raw.area,
    year: raw.year,
    position: raw.position,
    language: raw.language,
    question: fromStudyItem(row, assets),
    correctKey: alternatives.find((a) => a.is_correct)?.key ?? null,
    payload: payload.data,
    skill: raw.skill,
    skillSecondary: raw.skill_secondary,
    subject: raw.subject
      ? { code: raw.subject.code, path: [raw.subject.grandparent, raw.subject.parent, raw.subject.label].filter((x): x is string => Boolean(x)) }
      : null,
    stats:
      st && st.respondents > 0
        ? {
            edition: st.edition,
            correctRate: st.correct / st.respondents,
            blankRate: st.blank / st.respondents,
            byKey: marked ? Object.fromEntries(Object.entries(marked).map(([k, n]) => [k, n / st.alternatives_respondents!])) : {},
          }
        : null,
  };
}

const short = (s: string, n = 96) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Opções do ajuste para uma área: habilidades, assuntos (objetos e subdivisões) e tipos de distrator. */
export async function loadReviewOptions(supabase: Editor, area: AreaCode): Promise<ReviewOptions> {
  const [skills, subjects, types] = await Promise.all([
    supabase
      .from("skills")
      .select("code, number, description, areas!inner(code, matrix_versions!inner(status))")
      .eq("areas.code", area)
      .eq("areas.matrix_versions.status", "published")
      .order("number"),
    supabase.from("subjects").select("id, code, label, kind, parent_id").eq("area_code", area).not("code", "is", null),
    supabase.from("distractor_types").select("code, label").eq("taxonomy_version", "v0-proposta").order("label"),
  ]);
  for (const r of [skills, subjects, types]) if (r.error) throw new Error(`opções da conferência: ${r.error.message}`);
  const nodes = new Map((subjects.data ?? []).map((s) => [s.id as string, s as { id: string; code: string; label: string; kind: string; parent_id: string | null }]));
  const natural = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
  const options: SubjectOption[] = [];
  for (const s of nodes.values()) {
    if (s.kind !== "objeto" && s.kind !== "assunto") continue;
    const parent = s.parent_id ? nodes.get(s.parent_id) : undefined;
    const tema = s.kind === "assunto" ? (parent?.parent_id ? nodes.get(parent.parent_id) : undefined) : parent;
    options.push({
      id: s.id,
      code: s.code,
      label: s.kind === "assunto" ? `↳ ${short(s.label)}` : short(s.label),
      group: tema ? short(tema.label, 70) : "Sem tema",
    });
  }
  options.sort((a, b) => natural(a.code, b.code));
  return {
    skills: (skills.data ?? []).map((s) => ({ code: s.code as string, description: s.description as string })),
    subjects: options,
    distractorTypes: (types.data ?? []) as { code: string; label: string }[],
  };
}
