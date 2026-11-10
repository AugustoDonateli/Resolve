import { describe, expect, it } from "vitest";
import { reviewTriage, TARGET_MS, type ReviewInput } from "./triage-review";

const item = (
  position: number,
  decision: ReviewInput["decision"],
  resolved: ReviewInput["resolved"],
): ReviewInput => ({
  position,
  decision,
  triageMs: 10_000,
  windowClosed: false,
  resolved,
});

describe("conferência da triagem", () => {
  it("só entra no denominador o que foi resolvido depois; nada é inferido", () => {
    const r = reviewTriage([
      item(1, "agora", { correct: true, activeMs: 60_000 }),
      item(2, "agora", { correct: true, activeMs: TARGET_MS + 1 }),
      item(3, "agora", { correct: false, activeMs: 30_000 }),
      item(4, "agora", null),
      item(5, "depois", { correct: true, activeMs: 200_000 }),
      item(6, "chuto", null),
      item(7, "chuto", { correct: null, activeMs: 5_000 }),
    ]);
    expect(r.agora).toEqual({
      decided: 4,
      observed: 3,
      correctWithinTarget: 1,
      notObserved: 1,
    });
    expect(r.depois).toEqual({ decided: 1, observed: 1, correct: 1 });
    expect(r.chuto).toEqual({ decided: 2, observed: 0, correct: 0 });
    expect(r.rows.map((x) => x.outcome)).toEqual([
      "acertou",
      "acertou",
      "errou",
      "nao_observado",
      "acertou",
      "nao_observado",
      "anulada",
    ]);
    expect(r.rows[3]!.withinTarget).toBeNull();
  });
});
