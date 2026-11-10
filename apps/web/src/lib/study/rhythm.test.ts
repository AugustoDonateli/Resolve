import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  median,
  parseConfig,
  questionsFor,
  rhythmStats,
} from "./rhythm";

describe("blocos de ritmo", () => {
  it("configuração ajustável com padrão 3/4 e aviso nunca antes do alvo", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseConfig('{"targetMin":2,"warnMin":3}')).toEqual({
      targetMin: 2,
      warnMin: 3,
    });
    expect(parseConfig('{"targetMin":5,"warnMin":4}')).toEqual({
      targetMin: 5,
      warnMin: 6,
    });
    expect(parseConfig("quebrado")).toEqual(DEFAULT_CONFIG);
  });
  it("questões pelo alvo, limitadas ao disponível", () => {
    expect(questionsFor(45, DEFAULT_CONFIG, 100)).toBe(15);
    expect(questionsFor(180, DEFAULT_CONFIG, 20)).toBe(20);
  });
  it("média, mediana, acerto e conclusão", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const s = rhythmStats([
      { answered: true, correct: true, ms: 120_000 },
      { answered: true, correct: false, ms: 240_000 },
      { answered: false, correct: null, ms: 30_000 },
    ]);
    expect(s).toEqual({
      total: 3,
      answered: 2,
      correct: 1,
      graded: 2,
      meanMs: 180_000,
      medianMs: 180_000,
      completed: false,
    });
  });
});
