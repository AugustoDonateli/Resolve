import { describe, expect, it } from "vitest";
import { eap, probability, scenario, validateConfig, type ItemParameters, type ModelConfig } from "./engine";

/**
 * Casos matemáticos controlados. Parâmetros aqui são sintéticos e só servem para testar o cálculo;
 * nenhum deles representa item do Enem.
 */
const cfg: ModelConfig = {
  D: 1,
  prior: { kind: "normal", mean: 0, sd: 1 },
  quadrature: { from: -6, to: 6, points: 121 },
  transform: null,
  intervalZ: 1.645,
};
const params = (list: [string, ItemParameters | null][]) => new Map(list);

/** Referência independente: integração por soma de Riemann numa grade 50× mais fina. */
function bruteForce(resp: { p: ItemParameters; correct: boolean }[], D: number) {
  let z = 0, m1 = 0, m2 = 0;
  for (let t = -8; t <= 8; t += 0.002) {
    let like = Math.exp(-0.5 * t * t);
    for (const r of resp) {
      const pr = r.p.c + (1 - r.p.c) / (1 + Math.exp(-D * r.p.a * (t - r.p.b)));
      like *= r.correct ? pr : 1 - pr;
    }
    z += like; m1 += t * like; m2 += t * t * like;
  }
  const mean = m1 / z;
  return { mean, sd: Math.sqrt(m2 / z - mean * mean) };
}

describe("3PL", () => {
  it("probabilidade: no ponto b vale c + (1 − c)/2; tende a c e a 1 nos extremos", () => {
    const p = { a: 1.2, b: 0.5, c: 0.2 };
    expect(probability(0.5, p, 1)).toBeCloseTo(0.6, 12);
    expect(probability(-30, p, 1)).toBeCloseTo(0.2, 6);
    expect(probability(30, p, 1)).toBeCloseTo(1, 6);
  });

  it("configuração sem D, priori ou grade válida é recusada (não há valores padrão)", () => {
    expect(validateConfig({ ...cfg, D: 0 })).not.toBeNull();
    expect(validateConfig({ ...cfg, quadrature: { from: 0, to: 0, points: 121 } })).not.toBeNull();
    expect(() => eap([], new Map(), { ...cfg, prior: { kind: "normal", mean: 0, sd: 0 } })).toThrow();
  });
});

describe("EAP", () => {
  it("sem respostas, a posteriori é a priori (média 0, desvio 1)", () => {
    const e = eap([], new Map(), cfg);
    expect(e.theta).toBeCloseTo(0, 6);
    expect(e.thetaSd).toBeCloseTo(1, 3);
    expect(e.nUsed).toBe(0);
  });

  it("simetria: um item b=0, c=0 certo e errado dá estimativas opostas", () => {
    const pm = params([["i1", { a: 1.5, b: 0, c: 0 }]]);
    const up = eap([{ itemId: "i1", correct: true }], pm, cfg);
    const down = eap([{ itemId: "i1", correct: false }], pm, cfg);
    expect(up.theta).toBeGreaterThan(0);
    expect(up.theta).toBeCloseTo(-down.theta, 8);
    expect(up.thetaSd).toBeCloseTo(down.thetaSd, 8);
  });

  it("confere com a integração independente em grade fina (vetor misto com acerto ao acaso)", () => {
    const items: [string, ItemParameters][] = [
      ["a", { a: 1.1, b: -1.2, c: 0.18 }],
      ["b", { a: 0.8, b: 0.3, c: 0.22 }],
      ["c", { a: 2.0, b: 1.1, c: 0.15 }],
      ["d", { a: 1.4, b: 0.0, c: 0.2 }],
      ["e", { a: 0.6, b: 2.2, c: 0.25 }],
    ];
    const answers = [true, true, false, true, false];
    const resp = items.map(([id], i) => ({ itemId: id, correct: answers[i]! }));
    const ref = bruteForce(items.map(([, p], i) => ({ p, correct: answers[i]! })), 1);
    const e = eap(resp, params(items), cfg);
    expect(Math.abs(e.theta - ref.mean)).toBeLessThan(1e-3);
    expect(Math.abs(e.thetaSd - ref.sd)).toBeLessThan(1e-3);
    const e17 = eap(resp, params(items), { ...cfg, D: 1.7 });
    const ref17 = bruteForce(items.map(([, p], i) => ({ p, correct: answers[i]! })), 1.7);
    expect(Math.abs(e17.theta - ref17.mean)).toBeLessThan(1e-3);
  });

  it("item sem parâmetro válido fica fora e é contado, nunca vira zero", () => {
    const pm = params([["ok", { a: 1, b: 0, c: 0.2 }], ["sem", null], ["ruim", { a: -1, b: 0, c: 0.2 }]]);
    const e = eap(
      [{ itemId: "ok", correct: true }, { itemId: "sem", correct: false }, { itemId: "ruim", correct: false }],
      pm,
      cfg,
    );
    expect(e.nUsed).toBe(1);
    expect(e.excluded.sort()).toEqual(["ruim", "sem"]);
    expect(e.theta).toBeCloseTo(eap([{ itemId: "ok", correct: true }], pm, cfg).theta, 12);
  });

  it("mais itens reduzem a incerteza; acerto ao acaso (c maior) rende menos", () => {
    const many = params(Array.from({ length: 20 }, (_, i) => [`i${i}`, { a: 1.2, b: -1 + i * 0.1, c: 0.2 }] as [string, ItemParameters]));
    const few = eap([{ itemId: "i0", correct: true }, { itemId: "i1", correct: false }], many, cfg);
    const lots = eap(Array.from({ length: 20 }, (_, i) => ({ itemId: `i${i}`, correct: i % 2 === 0 })), many, cfg);
    expect(lots.thetaSd).toBeLessThan(few.thetaSd);
    const lowC = eap([{ itemId: "x", correct: true }], params([["x", { a: 1, b: 0, c: 0 }]]), cfg);
    const highC = eap([{ itemId: "x", correct: true }], params([["x", { a: 1, b: 0, c: 0.35 }]]), cfg);
    expect(highC.theta).toBeLessThan(lowC.theta);
  });

  it("transformação registrada leva θ e a faixa para a escala de notas", () => {
    const pm = params([["i1", { a: 1, b: 0, c: 0.2 }]]);
    const t = { slope: 100, intercept: 500 };
    const e = eap([{ itemId: "i1", correct: true }], pm, { ...cfg, transform: t });
    expect(e.score).toBeCloseTo(500 + 100 * e.theta, 9);
    expect(e.upper - e.lower).toBeCloseTo(2 * 1.645 * 100 * e.thetaSd, 9);
  });
});

describe("cenários", () => {
  const items: [string, ItemParameters][] = Array.from({ length: 8 }, (_, i) => [`q${i}`, { a: 0.9 + i * 0.1, b: -1.5 + i * 0.4, c: 0.2 }]);
  const pm = params(items);
  const resp = items.map(([id], i) => ({ itemId: id, correct: i < 4 }));
  const tcfg = { ...cfg, transform: { slope: 100, intercept: 500 } };

  it("o cenário é idêntico a recalcular o vetor modificado", () => {
    const sc = scenario(resp, pm, tcfg, { label: "acertar q6", changes: [{ itemId: "q6", correct: true }] });
    const direct = eap(resp.map((r) => (r.itemId === "q6" ? { ...r, correct: true } : r)), pm, tcfg);
    expect(sc.estimate.score).toBeCloseTo(direct.score, 12);
    expect(sc.delta).toBeCloseTo(direct.score - eap(resp, pm, tcfg).score, 12);
  });

  it("diferenças de cenários não são parcelas somáveis", () => {
    const a = scenario(resp, pm, tcfg, { label: "q5", changes: [{ itemId: "q5", correct: true }] }).delta;
    const b = scenario(resp, pm, tcfg, { label: "q6", changes: [{ itemId: "q6", correct: true }] }).delta;
    const both = scenario(resp, pm, tcfg, {
      label: "q5 e q6",
      changes: [{ itemId: "q5", correct: true }, { itemId: "q6", correct: true }],
    }).delta;
    expect(Math.abs(both - (a + b))).toBeGreaterThan(0.01);
  });
});
