import { describe, expect, it } from "vitest";
import { errorPattern, extremes, read, type Tally } from "./rule";

const t = (answers: number, correct: number, brazilSum: number): Tally => ({ answers, correct, withBrazil: answers, brazilSum, correctWithBrazil: correct });

describe("perfil de aprendizado (perfil-v1)", () => {
  it("não classifica sem respostas suficientes e diz quantas faltam", () => {
    expect(read(t(0, 0, 0), 10)).toMatchObject({ level: null, headline: "Sem respostas ainda" });
    expect(read(t(8, 6, 3), 10)).toMatchObject({ level: null, headline: "Faltam 2 respostas para comparar", detail: "Você acertou 6 de 8." });
    expect(read(t(9, 1, 3), 10).headline).toBe("Falta 1 resposta para comparar");
  });
  it("compara com quem fez a prova nas mesmas questões", () => {
    expect(read(t(20, 14, 9), 10)).toMatchObject({ level: "bem", detail: "Você acertou 14 de 20. Nas mesmas questões, quem fez o Enem acertou em média 9." });
    expect(read(t(20, 9, 9.6), 10).level).toBe("media");
    expect(read(t(52, 7, 25.02), 10)).toMatchObject({ level: "reforco", headline: "Precisa de reforço" });
  });
  it("questão sem taxa do Inep não entra na comparação, mas entra na contagem", () => {
    const r = read({ answers: 12, correct: 8, withBrazil: 10, brazilSum: 4, correctWithBrazil: 7 }, 10);
    expect(r.level).toBe("bem");
    expect(r.detail).toContain("Você acertou 8 de 12.");
  });
  it("aponta a área mais forte e a mais fraca só quando há duas para comparar", () => {
    const rows = [
      { label: "Humanas", reading: read(t(20, 14, 9), 10) },
      { label: "Matemática", reading: read(t(20, 3, 7), 10) },
      { label: "Natureza", reading: read(t(4, 4, 1), 10) },
    ];
    expect(extremes(rows)).toEqual({ strongest: "Humanas", weakest: "Matemática" });
    expect(extremes(rows.slice(0, 1))).toBeNull();
    // Tudo abaixo da média: não há "ponto forte", só onde reforçar mais.
    const low = [
      { label: "Natureza", reading: read(t(13, 1, 4.2), 10) },
      { label: "Linguagens", reading: read(t(52, 7, 25), 10) },
    ];
    expect(extremes(low)).toEqual({ strongest: null, weakest: "Linguagens" });
  });
  it("padrão de erro: ignora o que não tem tipo e exige cinco erros identificados", () => {
    const d = (code: string, n: number) => ({ code, label: code, definition: "", n });
    expect(errorPattern([d("nao_classificado", 27), d("reducao", 3), d("contradicao", 1)], 31)).toBeNull();
    const p = errorPattern([d("nao_classificado", 27), d("reducao", 24), d("erro_de_calculo_previsto", 20), d("contradicao", 8)], 88)!;
    expect(p.top.code).toBe("reducao");
    expect(p.classified).toBe(52);
    expect(Math.round(p.share * 100)).toBe(46);
    expect(p.others.map((o) => o.code)).toEqual(["erro_de_calculo_previsto", "contradicao"]);
  });
});
