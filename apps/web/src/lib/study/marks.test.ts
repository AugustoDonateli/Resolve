import { describe, expect, it } from "vitest";
import { splitMarks } from "./marks";

describe("faixas de marca-texto", () => {
  const t = "0123456789";
  it("marca o trecho e mantém o resto na ordem", () => {
    expect(splitMarks(t, [{ start: 3, end: 6 }])).toEqual([
      { text: "012", marked: false },
      { text: "345", marked: true },
      { text: "6789", marked: false },
    ]);
  });
  it("funde faixas sobrepostas e corta o que passa do trecho", () => {
    expect(splitMarks(t, [{ start: 2, end: 5 }, { start: 4, end: 20 }], 1, 8)).toEqual([
      { text: "1", marked: false },
      { text: "234567", marked: true },
    ]);
  });
  it("sem faixa no trecho devolve o texto inteiro, sem marca", () => {
    expect(splitMarks(t, [{ start: 8, end: 9 }], 0, 5)).toEqual([{ text: "01234", marked: false }]);
    expect(splitMarks("", [])).toEqual([{ text: "", marked: false }]);
  });
  it("posições valem em UTF-16 (emoji conta dois)", () => {
    const s = "a😀b trecho";
    const i = s.indexOf("trecho");
    expect(splitMarks(s, [{ start: i, end: i + 6 }]).at(-1)).toEqual({ text: "trecho", marked: true });
  });
});
