import { describe, expect, it } from "vitest";
import { demoSkills, evaluate, recentRefs } from "./constellation";

const by = (id: string) => demoSkills.find((s) => s.id === id)!;

describe("regra de suficiência por habilidade (plano §7)", () => {
  it("D1 tem evidência suficiente: 9 sem ajuda, 6 itens, 5 dias", () => {
    const e = evaluate(by("d1").attempts);
    expect(e).toMatchObject({ sufficient: true, unassisted: 9, distinctItems: 6, days: 5, correctUnassisted: 7 });
  });

  it("D2 atinge exatamente os mínimos", () => {
    const e = evaluate(by("d2").attempts);
    expect(e.sufficient).toBe(true);
    expect(e.unassisted).toBe(8);
    expect(e.distinctItems).toBe(5);
  });

  it("D3 fica com dados insuficientes e diz o que falta", () => {
    const e = evaluate(by("d3").attempts);
    expect(e.sufficient).toBe(false);
    expect(e.missing).toEqual(["3 tentativa(s) sem ajuda", "1 item(ns) diferente(s)", "1 dia(s) de estudo diferente(s)"]);
  });

  it("tentativas com ajuda não contam (D4: 10 tentativas, 7 sem ajuda)", () => {
    const e = evaluate(by("d4").attempts);
    expect(e.withHelp).toBe(3);
    expect(e.unassisted).toBe(7);
    expect(e.sufficient).toBe(false);
    expect(e.missing[0]).toBe("1 tentativa(s) sem ajuda");
  });

  it("sem tentativas, acerto é nulo e não zero", () => {
    expect(evaluate([]).accuracy).toBeNull();
  });

  it("abre no máximo oito referências, das mais recentes", () => {
    const refs = recentRefs(by("d1"));
    expect(refs).toHaveLength(8);
    expect(refs.every((r, i) => i === 0 || r.daysAgo >= refs[i - 1]!.daysAgo)).toBe(true);
  });
});
