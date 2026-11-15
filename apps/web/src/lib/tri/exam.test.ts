import { describe, expect, it } from "vitest";
import { eap, type ItemParameters, type ModelConfig } from "./engine";
import { scoreExam } from "./exam";

/** Parâmetros sintéticos: só testam a regra, não representam itens do Enem. */
const config: ModelConfig = {
  D: 1,
  prior: { kind: "normal", mean: 0, sd: 1 },
  quadrature: { from: -4, to: 4, points: 40 },
  transform: { slope: 110, intercept: 500 },
  intervalZ: 1.645,
};
const models = new Map([["MT", { id: "teste-mt", status: "validado", config }]]);
const params = new Map<string, ItemParameters | null>(
  Array.from({ length: 6 }, (_, i) => [`q${i}`, { a: 1.5, b: -1 + i * 0.4, c: 0.2 }] as [string, ItemParameters]),
);
params.set("abandonado", null);

describe("nota da prova por área", () => {
  it("em branco conta como erro e item abandonado fica fora", () => {
    const items = [
      { itemId: "q0", correct: true, blank: false },
      { itemId: "q1", correct: true, blank: false },
      { itemId: "q2", correct: false, blank: true },
      { itemId: "abandonado", correct: true, blank: false },
    ];
    const [s] = scoreExam([{ area: "MT", label: "Matemática", items }], models, params);
    const direct = eap(items.map((i) => ({ itemId: i.itemId, correct: i.correct })), params, config);
    expect(s!.status).toBe("ok");
    expect(s!.score).toBeCloseTo(direct.score, 9);
    expect(s!.nUsed).toBe(3);
    expect(s!.excluded).toBe(1);
    expect(s!.correct).toBe(3);
  });

  it("área inteira em branco recebe 0 (regra do Inep), sem passar pelo modelo", () => {
    const items = ["q0", "q1"].map((itemId) => ({ itemId, correct: false, blank: true }));
    const [s] = scoreExam([{ area: "MT", label: "Matemática", items }], models, params);
    expect(s).toMatchObject({ status: "em_branco", score: 0 });
  });

  it("sem modelo da área, a nota fica indisponível", () => {
    const [s] = scoreExam([{ area: "LC", label: "Linguagens", items: [{ itemId: "q0", correct: true, blank: false }] }], models, params);
    expect(s).toMatchObject({ status: "sem_modelo", score: null });
  });
});
