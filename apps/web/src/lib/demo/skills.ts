/**
 * DEMONSTRAÇÃO dos treinos de habilidade com a questão demonstrativa (não é item do Enem).
 * Evidência e distratores vêm das anotações escritas para o protótipo; nada é gravado.
 */
import type { SkillBackend, SkillEntry, SkillResult } from "@/components/skills/skill-runner";
import type { StudyQuestion } from "@/lib/study/question-types";
import { demoQuestion } from "./question";

const CODE: Record<string, string> = {
  Generalização: "generalizacao",
  "Isca de palavra": "isca_de_palavra",
  Redução: "reducao",
  Contradição: "contradicao",
};

const blocks = demoQuestion.paragraphs.map((segs, i) => ({ id: `p${i + 1}`, type: "paragraph" as const, text: segs.map((s) => s.text).join("") }));

function anchorRange(anchor: string) {
  for (const [i, segs] of demoQuestion.paragraphs.entries()) {
    let at = 0;
    for (const s of segs) {
      if ("anchor" in s && s.anchor === anchor) return { block_id: `p${i + 1}`, start_utf16: at, end_utf16: at + s.text.length };
      at += s.text.length;
    }
  }
  return null;
}

export const demoSkillEntry: SkillEntry = {
  id: "demo-q1",
  question: {
    area: "LC",
    origin: "questão demonstrativa (não é do Enem)",
    stimulus: blocks,
    command: [{ id: "c1", type: "paragraph", text: demoQuestion.command.map((s) => s.text).join("") }],
    alternatives: demoQuestion.alternatives.map((a) => ({ key: a.key, letter: a.letter, blocks: [{ id: `a${a.key}`, type: "paragraph", text: a.text }] })),
  } satisfies StudyQuestion,
};

const correct = demoQuestion.alternatives.find((a) => a.correct)!.key;
const result: SkillResult = {
  correctKey: correct,
  annotationStatus: "aprovadas",
  evidence: [{ ...anchorRange("ev-b")!, rationale: demoQuestion.notes.find((n) => n.anchor === "ev-b")?.body ?? null }],
  distractors: demoQuestion.alternatives
    .filter((a) => !a.correct && a.distractor)
    .map((a) => ({ key: a.key, type: CODE[a.distractor!] ?? "nao_classificado", label: a.distractor!, rationale: a.rationale })),
};

export const demoBackend: SkillBackend = {
  async recordEvidence() {
    return null;
  },
  async submit() {
    return { ok: true, correctKey: correct };
  },
  async recordChoices() {
    return null;
  },
  async result() {
    return result;
  },
};
