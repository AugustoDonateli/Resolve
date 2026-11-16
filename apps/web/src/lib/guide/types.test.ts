import { describe, expect, it } from "vitest";
import { currentStep, EXAM_DAY_GUESS, fichaSchema, GUIDE_KEYS, parseGuide, TIPS, TOUR } from "./types";

describe("guia de primeiros passos", () => {
  it("lê o que a conta já viu e ignora o que está fora do formato", () => {
    const g = parseGuide({ ficha: "2026-11-16T12:00:00Z", tour: "", outra: "x", dica_ritmo: 3 });
    expect(g.ficha).toBe(true);
    expect(g.tour).toBe(false);
    expect(g.dica_ritmo).toBe(false);
    expect(Object.keys(g)).toEqual([...GUIDE_KEYS]);
    expect(Object.values(parseGuide(null)).some(Boolean)).toBe(false);
    expect(Object.values(parseGuide(["ficha"])).some(Boolean)).toBe(false);
  });

  it("anda um passo por vez, na ordem, e termina", () => {
    expect(currentStep({ ficha: false, primeira_questao: false, tour: false })).toBe("ficha");
    expect(currentStep({ ficha: true, primeira_questao: false, tour: true })).toBe("primeira_questao");
    expect(currentStep({ ficha: true, primeira_questao: true, tour: false })).toBe("tour");
    expect(currentStep({ ficha: true, primeira_questao: true, tour: true })).toBeNull();
  });

  it("a ficha aceita curso em branco, mas não curso sem instituição", () => {
    const base = { course: "", institution: "", weeklyHours: 10, language: "ingles" as const, examDay: EXAM_DAY_GUESS };
    expect(fichaSchema.safeParse(base).success).toBe(true);
    expect(fichaSchema.safeParse({ ...base, weeklyHours: null, language: null, examDay: null }).success).toBe(true);
    expect(fichaSchema.safeParse({ ...base, course: "Medicina" }).success).toBe(false);
    expect(fichaSchema.safeParse({ ...base, course: " Medicina ", institution: "UFMG" }).data?.course).toBe("Medicina");
    expect(fichaSchema.safeParse({ ...base, weeklyHours: 0 }).success).toBe(false);
    expect(fichaSchema.safeParse({ ...base, examDay: "7/11/2027" }).success).toBe(false);
  });

  it("a estimativa da data cai num domingo de novembro de 2027", () => {
    const d = new Date(`${EXAM_DAY_GUESS}T12:00:00Z`);
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDay()]).toEqual([2027, 10, 0]);
  });

  it("textos para o aluno: sem exclamação, sem palavras de efeito", () => {
    const texts = [...Object.values(TIPS).flatMap((t) => [t.title, t.what, t.when, t.time]), ...TOUR.flatMap((s) => [s.title, s.text])];
    for (const t of texts) expect(t).not.toMatch(/!|mergulh|jornada|desvend|poderos|incríve|segredo/i);
  });
});
