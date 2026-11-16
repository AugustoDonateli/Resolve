import { describe, expect, it } from "vitest";
import {
  adjustProblems,
  evidenceMarks,
  nextPending,
  payloadSchema,
  pendingByArea,
  rowLabel,
  stepsFromText,
  type AnnotationPayload,
} from "./annotation-types";

const payload: AnnotationPayload = {
  schema: "anotacao/v1",
  skill: "H18",
  skill_secondary: null,
  subject: "0b8d3a52-6c1f-4c3a-9b1e-1f2a3b4c5d6e",
  subject_code: "LC.3.2",
  content_dependency: 1,
  evidence: [{ block_id: "s1", start_utf16: 4, end_utf16: 9, quote: "claro", rationale: "É o trecho que responde." }],
  distractors: ["A", "B", "D", "E"].map((key) => ({ key, type: "extrapolacao", secondary: "nenhum", rationale: "Vai além do que o texto afirma." })),
  steps: ["Ler o comando.", "Voltar ao texto."],
  uncertainties: [],
};

describe("conferência das anotações", () => {
  it("aceita o formato anotacao/v1 e recusa o que o banco recusaria", () => {
    expect(payloadSchema.safeParse(payload).success).toBe(true);
    expect(payloadSchema.safeParse({ ...payload, content_dependency: 4 }).success).toBe(false);
    expect(payloadSchema.safeParse({ ...payload, steps: [] }).success).toBe(false);
    expect(payloadSchema.safeParse({ ...payload, skill: "18" }).success).toBe(false);
  });

  it("marca a evidência na posição gravada e procura a citação quando a posição não confere", () => {
    const blocks = [{ id: "s1", type: "paragraph" as const, text: "Tão claro quanto o dia." }];
    expect(evidenceMarks(payload.evidence, blocks)).toEqual({ marks: { s1: [{ start: 4, end: 9 }] }, missing: [] });
    const moved = [{ ...payload.evidence[0]!, start_utf16: 0, end_utf16: 5 }];
    expect(evidenceMarks(moved, blocks).marks.s1).toEqual([{ start: 4, end: 9 }]);
    const gone = [{ ...payload.evidence[0]!, block_id: "s2" }, { ...payload.evidence[0]!, quote: "escuro" }];
    expect(evidenceMarks(gone, blocks)).toEqual({ marks: {}, missing: [0, 1] });
  });

  it("acha a próxima por conferir dando a volta, e avisa quando a área acabou", () => {
    const rows = [{ status: "aprovada" }, { status: "proposta" }, { status: "devolvida" }, { status: "proposta" }] as const;
    expect(nextPending([...rows], 1)).toBe(3);
    expect(nextPending([...rows], 3)).toBe(1);
    expect(nextPending([{ status: "proposta" }], 0)).toBe(0);
    expect(nextPending([{ status: "aprovada" }, { status: "devolvida" }], 0)).toBe(-1);
  });

  it("conta o que falta por área", () => {
    const c = pendingByArea([
      { area: "MT", status: "proposta" },
      { area: "MT", status: "aprovada" },
      { area: "LC", status: "devolvida" },
    ]);
    expect(c.MT).toEqual({ pending: 1, total: 2 });
    expect(c.LC).toEqual({ pending: 0, total: 1 });
    expect(c.CH).toEqual({ pending: 0, total: 0 });
  });

  it("rótulo da questão e passos a partir do texto", () => {
    expect(rowLabel({ year: 2025, position: 3, language: "ingles" })).toBe("2025 · Q 3 (inglês)");
    expect(rowLabel({ year: 2024, position: 136, language: null })).toBe("2024 · Q 136");
    expect(stepsFromText("1. Ler o comando.\n\n 2) Voltar ao texto.\nMarcar C.")).toEqual(["Ler o comando.", "Voltar ao texto.", "Marcar C."]);
  });

  it("aponta o que impede aprovar um ajuste", () => {
    expect(adjustProblems(payload, ["A", "B", "D", "E"])).toEqual([]);
    const bad = { ...payload, skill_secondary: "H18", steps: [], distractors: payload.distractors.slice(1).map((d, i) => (i ? d : { ...d, rationale: "curta" })) };
    expect(adjustProblems(bad, ["A", "B", "D", "E"])).toHaveLength(4);
  });
});
