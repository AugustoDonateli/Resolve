import { describe, expect, it } from "vitest";
import { neededIn, weightedAverage } from "./course";

const all = (v: number) => ({ LC: v, CH: v, CN: v, MT: v, RED: v });

describe("meta de curso", () => {
  it("sem pesos, a média é simples", () => {
    expect(weightedAverage({ LC: 600, CH: 700, CN: 500, MT: 800, RED: 900 }, { weights: null })).toBe(700);
  });
  it("com pesos, pondera cada parte (pesos ausentes valem 1)", () => {
    // (600*1 + 600*1 + 600*2 + 900*3 + 800*1) / 8 = 5900/8
    expect(weightedAverage({ LC: 600, CH: 600, CN: 600, MT: 900, RED: 800 }, { weights: { CN: 2, MT: 3 } })).toBeCloseTo(737.5, 6);
  });
  it("falta uma nota: não calcula", () => {
    expect(weightedAverage({ LC: 600, CH: 600, CN: 600, MT: 600 }, { weights: null })).toBeNull();
  });
  it("quanto falta numa parte para chegar ao corte; o resultado fecha a conta", () => {
    const goal = { weights: { MT: 3, RED: 2 }, cutoff: 750 };
    const scores = { ...all(700), RED: 0 };
    const r = neededIn("RED", scores, goal)!;
    expect(weightedAverage({ ...scores, RED: r.needed }, goal)).toBeCloseTo(750, 6);
  });
  it("sem nota de corte não há o que calcular", () => {
    expect(neededIn("MT", all(600), { weights: null, cutoff: null })).toBeNull();
  });
});
