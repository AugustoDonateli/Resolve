/**
 * Raio-X textual (F3-T04): transforma o retorno de `item_explanation` em conteúdo exibível.
 * Os trechos de evidência são recortados do próprio texto da questão pelas posições UTF-16
 * gravadas na revisão; um trecho que não confere aparece como indisponível, nunca inventado.
 */
import type { QuestionBlock, StudyQuestion } from "./question-types";

export interface Explanation {
  released: boolean;
  reason?: "respondida" | "ajuda";
  skill?: { code: string; description: string } | null;
  evidence?: {
    type: "text" | "figure" | "calculation";
    block_id: string | null;
    start_utf16: number | null;
    end_utf16: number | null;
    rationale: string | null;
  }[];
  distractors?: {
    key: string;
    type: string;
    label: string;
    rationale: string;
    primary: boolean;
  }[];
  steps?: { id: string; text: string }[];
  correct_key?: string | null;
}

export interface RaioXView {
  reason: "respondida" | "ajuda";
  skill: { code: string; description: string } | null;
  evidence: { quote: string | null; where: string; rationale: string }[];
  distractors: { letter: string; labels: string[]; rationale: string }[];
  steps: string[];
  correctLetter: string | null;
}

function blockText(
  q: StudyQuestion,
  id: string,
): { text: string; where: string } | null {
  const find = (blocks: QuestionBlock[]) =>
    blocks.find((b) => b.id === id && typeof b.text === "string");
  const s = find(q.stimulus);
  if (s) return { text: s.text!, where: "no texto-base" };
  const c = find(q.command);
  if (c) return { text: c.text!, where: "no comando" };
  return null;
}

export function buildRaioX(q: StudyQuestion, x: Explanation): RaioXView | null {
  if (!x.released) return null;
  const letterOf = (key: string) =>
    q.alternatives.find((a) => a.key === key)?.letter ?? key;
  const evidence = (x.evidence ?? []).map((e) => {
    if (
      e.type === "text" &&
      e.block_id &&
      e.start_utf16 !== null &&
      e.end_utf16 !== null
    ) {
      const b = blockText(q, e.block_id);
      // String do JavaScript é UTF-16: as posições gravadas valem direto.
      const quote =
        b && e.end_utf16 <= b.text.length
          ? b.text.slice(e.start_utf16, e.end_utf16)
          : null;
      return {
        quote,
        where: b?.where ?? "no texto",
        rationale: e.rationale ?? "",
      };
    }
    return {
      quote: null,
      where: e.type === "figure" ? "na figura" : "no cálculo",
      rationale: e.rationale ?? "",
    };
  });
  const byKey = new Map<string, { labels: string[]; rationale: string }>();
  for (const d of x.distractors ?? []) {
    const cur = byKey.get(d.key) ?? { labels: [], rationale: d.rationale };
    cur.labels.push(d.label);
    byKey.set(d.key, cur);
  }
  const distractors = [...byKey.entries()]
    .map(([key, v]) => ({ letter: letterOf(key), ...v }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
  return {
    reason: x.reason ?? "respondida",
    skill: x.skill ?? null,
    evidence,
    distractors,
    steps: (x.steps ?? []).map((s) => s.text).filter(Boolean),
    correctLetter: x.correct_key ? letterOf(x.correct_key) : null,
  };
}
