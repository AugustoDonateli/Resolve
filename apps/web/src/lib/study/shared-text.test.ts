import { describe, expect, it } from "vitest";
import type { StudyQuestion } from "./question-types";
import { markSharedTexts, packSharedTexts } from "./shared-text";

describe("texto compartilhado", () => {
  const stim = new Map<string, string | null>([["a", "T1"], ["b", null], ["c", "T1"], ["d", "T2"], ["e", "T2"], ["f", null]]);
  it("questões do mesmo texto entram juntas, na ordem dos candidatos", () => {
    expect(packSharedTexts(["a", "b", "d", "c", "f", "e"], stim, 6)).toEqual(["a", "c", "b", "d", "e", "f"]);
  });
  it("respeita o limite de questões", () => {
    expect(packSharedTexts(["b", "a", "d", "c"], stim, 2)).toEqual(["b", "a"]);
  });
  it("marca o grupo com os números na sessão; a primeira mostra o texto inteiro", () => {
    const q = () => ({ area: "LC" }) as StudyQuestion;
    const entries = ["a", "b", "c"].map((id) => ({ itemVersionId: id, question: q() }));
    markSharedTexts(entries, new Map([...stim].map(([k, v]) => [k, { stimulus_version_id: v }])));
    expect(entries[0]!.question.shared).toEqual({ positions: [1, 3], first: true });
    expect(entries[1]!.question.shared).toBeUndefined();
    expect(entries[2]!.question.shared).toEqual({ positions: [1, 3], first: false });
  });
});
