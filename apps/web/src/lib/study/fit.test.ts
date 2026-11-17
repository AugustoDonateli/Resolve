import { describe, expect, it } from "vitest";
import { pickFitted } from "./fit";

describe("treino na medida (medida-v1)", () => {
  const items = [-2, -1, 0, 0.4, 0.9, 2, 3].map((b, i) => ({ id: `q${i}`, b }));
  it("escolhe as mais próximas de um ponto logo acima do nível", () => {
    expect(pickFitted(items, 0, 3)).toEqual(["q3", "q2", "q4"]);
    expect(pickFitted(items, 2.5, 2)).toEqual(["q6", "q5"]);
  });
  it("não devolve mais do que existe e desempata sempre do mesmo jeito", () => {
    expect(pickFitted(items.slice(0, 2), 0, 10)).toEqual(["q1", "q0"]);
    expect(pickFitted([{ id: "b", b: 1 }, { id: "a", b: 1 }], 0.7, 2)).toEqual(["a", "b"]);
  });
});
