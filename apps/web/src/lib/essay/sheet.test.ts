import { describe, expect, it } from "vitest";
import { sheetSummary, SHEET_PROFILE, wrapLines } from "./sheet";

describe("folha simulada", () => {
  it("cada parágrafo começa em linha nova com recuo e nenhuma linha passa das colunas", () => {
    const text = `${"palavra ".repeat(20).trim()}\n\nSegundo parágrafo curto.`;
    const lines = wrapLines(text);
    expect(lines[0]!.text.startsWith("  palavra")).toBe(true);
    expect(lines.every((l) => l.text.length <= SHEET_PROFILE.columns)).toBe(
      true,
    );
    expect(lines.filter((l) => l.first).length).toBe(2);
    expect(lines.at(-1)!.text).toBe("  Segundo parágrafo curto.");
  });

  it("quebra simples dentro do parágrafo vira espaço; palavra enorme é partida", () => {
    expect(wrapLines("uma\nlinha", 64).map((l) => l.text)).toEqual([
      "  uma linha",
    ]);
    const big = wrapLines("x".repeat(130), 64).map((l) => l.text.length);
    expect(big).toEqual([64, 64, 4]);
  });

  it("a contagem só depende do texto (largura da tela não entra) e informa o excesso", () => {
    const text = Array.from(
      { length: 31 },
      (_, i) => `Parágrafo ${i + 1}.`,
    ).join("\n\n");
    expect(sheetSummary(text)).toEqual({ lines: 31, over: 1, limit: 30 });
    expect(sheetSummary("")).toEqual({ lines: 0, over: 0, limit: 30 });
    expect(wrapLines(text)).toEqual(wrapLines(text)); // determinístico
  });
});
