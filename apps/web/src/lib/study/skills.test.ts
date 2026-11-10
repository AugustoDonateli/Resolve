import { describe, expect, it } from "vitest";
import { addRange, compareDistractors, compareEvidence } from "./skills";

const ed = [{ block_id: "s2", start_utf16: 40, end_utf16: 140 }];

describe("evidência (evidencia-v1)", () => {
  it("corresponde quando cobre metade do trecho editorial", () => {
    expect(compareEvidence([{ block_id: "s2", start_utf16: 40, end_utf16: 90 }], ed)?.matched).toBe(true);
  });
  it("corresponde quando metade do marcado está dentro, mesmo cobrindo pouco", () => {
    const r = compareEvidence([{ block_id: "s2", start_utf16: 100, end_utf16: 120 }], ed)!;
    expect(r.bestCoverage).toBeCloseTo(0.2, 5);
    expect(r.precision).toBe(1);
    expect(r.matched).toBe(true);
  });
  it("não corresponde em outro bloco nem com marcação longa demais", () => {
    expect(compareEvidence([{ block_id: "s1", start_utf16: 40, end_utf16: 140 }], ed)?.matched).toBe(false);
    expect(compareEvidence([{ block_id: "s2", start_utf16: 0, end_utf16: 400 }], [{ block_id: "s2", start_utf16: 380, end_utf16: 400 }])?.matched).toBe(true);
    expect(compareEvidence([{ block_id: "s2", start_utf16: 0, end_utf16: 300 }], [{ block_id: "s2", start_utf16: 290, end_utf16: 400 }])?.matched).toBe(false);
  });
  it("sem etiqueta editorial ou sem marcação, não há comparação", () => {
    expect(compareEvidence([], ed)).toBeNull();
    expect(compareEvidence([{ block_id: "s2", start_utf16: 1, end_utf16: 5 }], [])).toBeNull();
  });
  it("trechos sobrepostos se juntam; no máximo três", () => {
    let r = addRange([], { block_id: "a", start_utf16: 0, end_utf16: 10 });
    r = addRange(r, { block_id: "a", start_utf16: 5, end_utf16: 20 });
    expect(r).toEqual([{ block_id: "a", start_utf16: 0, end_utf16: 20 }]);
    r = addRange(r, { block_id: "b", start_utf16: 0, end_utf16: 3 });
    r = addRange(r, { block_id: "c", start_utf16: 0, end_utf16: 3 });
    r = addRange(r, { block_id: "d", start_utf16: 0, end_utf16: 3 });
    expect(r.map((x) => x.block_id)).toEqual(["b", "c", "d"]);
  });
});

describe("distratores", () => {
  it("concorda pelo tipo primário; sem etiqueta, concordância nula", () => {
    const rows = compareDistractors(
      [{ key: "a", type: "generalizacao" }, { key: "c", type: "reducao" }],
      [{ key: "a", type: "generalizacao", label: "Generalização", rationale: "r" }, { key: "c", type: "isca_de_palavra", label: "Isca", rationale: "r" }],
    );
    expect(rows.map((r) => r.agrees)).toEqual([true, false]);
    expect(compareDistractors([{ key: "a", type: "nao_sei" }], null)[0]!.agrees).toBeNull();
  });
});
