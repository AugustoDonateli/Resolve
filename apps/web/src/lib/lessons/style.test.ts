import { describe, expect, it } from "vitest";
import { LESSONS } from "./index";
import { checkLesson, checkParagraph, sentences } from "./style";

describe("checagem de estilo das lições", () => {
  it("pega palavra de efeito, exclamação, emoji e pergunta retórica", () => {
    const p = (t: string) => checkParagraph(t, "teste").map((x) => x.problem);
    expect(p("Mergulhe nesse assunto.")[0]).toMatch(/palavra de efeito/);
    expect(p("Isso cai muito!")).toContain("exclamação");
    expect(p("Bora estudar 🙂")).toContain("emoji");
    expect(p("Você sabia que porcentagem cai muito? Pois é.")).toContain("pergunta retórica na abertura");
    expect(p("25% vira 0,25. Isso cai no Enem.")).toEqual([]);
  });
  it("corta frases sem quebrar números", () => {
    expect(sentences("25% vira 0,25. 135,25% vira 1,3525. Fim.")).toHaveLength(3);
    expect(sentences("São 1.000 pessoas. Depois, 2.000.")).toHaveLength(2);
  });
  it("frase longa demais e parágrafo longo demais", () => {
    const long = Array.from({ length: 40 }, () => "palavra").join(" ") + ".";
    expect(checkParagraph(long, "t").some((x) => /frase com 40/.test(x.problem))).toBe(true);
  });
  for (const l of LESSONS)
    it(`lição “${l.title}” passa na checagem`, () => {
      expect(checkLesson(l)).toEqual([]);
    });
  it("cada lição tem slug único e pegadinhas com número de microdados plausível", () => {
    expect(new Set(LESSONS.map((l) => l.slug)).size).toBe(LESSONS.length);
    for (const l of LESSONS)
      for (const t of l.traps) {
        expect(t.share).toBeGreaterThan(0);
        expect(t.share).toBeLessThan(100);
      }
  });
});
