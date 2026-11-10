import { describe, expect, it } from "vitest";
import type { StudyQuestion } from "./question-types";
import { buildRaioX } from "./raiox";

const q: StudyQuestion = {
  area: "LC",
  origin: "Enem",
  stimulus: [
    {
      id: "s1",
      type: "paragraph",
      text: "Texto com 😀 emoji antes do trecho importante.",
    },
  ],
  command: [
    {
      id: "c1",
      type: "paragraph",
      text: "O recurso usado para marcar a síntese da opinião foi",
    },
  ],
  alternatives: ["A", "B", "C", "D", "E"].map((k) => ({
    key: k,
    letter: k as "A",
    blocks: [],
  })),
};

describe("Raio-X textual", () => {
  it("bloqueado antes da resposta ou ajuda", () => {
    expect(buildRaioX(q, { released: false })).toBeNull();
  });

  it("recorta evidências pelo UTF-16 (inclusive depois de emoji) e agrupa distratores", () => {
    const s1 = q.stimulus[0]!.text!;
    const start = s1.indexOf("trecho importante");
    const v = buildRaioX(q, {
      released: true,
      reason: "respondida",
      skill: { code: "H18", description: "Identificar..." },
      evidence: [
        {
          type: "text",
          block_id: "c1",
          start_utf16: 30,
          end_utf16: 48,
          rationale: "Comando.",
        },
        {
          type: "text",
          block_id: "s1",
          start_utf16: start,
          end_utf16: start + 17,
          rationale: "Base.",
        },
        {
          type: "text",
          block_id: "s1",
          start_utf16: 0,
          end_utf16: 999,
          rationale: "Fora do texto.",
        },
        {
          type: "figure",
          block_id: null,
          start_utf16: null,
          end_utf16: null,
          rationale: "Figura.",
        },
      ],
      distractors: [
        {
          key: "B",
          type: "reducao",
          label: "Redução",
          rationale: "Pega só parte.",
          primary: true,
        },
        {
          key: "A",
          type: "extrapolacao",
          label: "Extrapolação",
          rationale: "Vai além.",
          primary: true,
        },
        {
          key: "B",
          type: "isca_de_palavra",
          label: "Isca de palavra",
          rationale: "Pega só parte.",
          primary: false,
        },
      ],
      steps: [{ id: "p1", text: "Primeiro passo." }],
      correct_key: "E",
    })!;
    expect(v.evidence.map((e) => e.quote)).toEqual([
      "síntese da opinião",
      "trecho importante",
      null,
      null,
    ]);
    expect(v.evidence.map((e) => e.where)).toEqual([
      "no comando",
      "no texto-base",
      "no texto-base",
      "na figura",
    ]);
    expect(v.distractors).toEqual([
      { letter: "A", labels: ["Extrapolação"], rationale: "Vai além." },
      {
        letter: "B",
        labels: ["Redução", "Isca de palavra"],
        rationale: "Pega só parte.",
      },
    ]);
    expect(v.steps).toEqual(["Primeiro passo."]);
    expect(v.correctLetter).toBe("E");
  });
});
