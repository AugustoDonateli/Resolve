import { describe, expect, it } from "vitest";
import { fromParagraphs, recover, toParagraphs, wordCount } from "./draft";

describe("rascunho de redação", () => {
  it("separa parágrafos por linha em branco e mantém quebras simples dentro do parágrafo", () => {
    const ps = toParagraphs(
      "Introdução aqui.\n\n\nDesenvolvimento\ncom quebra.\r\n\r\nConclusão.  \n\n   \n",
    );
    expect(ps).toEqual([
      { id: "p1", text: "Introdução aqui." },
      { id: "p2", text: "Desenvolvimento\ncom quebra." },
      { id: "p3", text: "Conclusão." },
    ]);
    expect(fromParagraphs(ps)).toBe(
      "Introdução aqui.\n\nDesenvolvimento\ncom quebra.\n\nConclusão.",
    );
    expect(toParagraphs("")).toEqual([]);
  });

  it("conta palavras com acento, hífen e números", () => {
    expect(wordCount("O bem-estar de 2025 é coletivo.")).toBe(6);
    expect(wordCount("  ")).toBe(0);
  });

  it("recupera a cópia do aparelho ou pede escolha, nunca sobrescreve em silêncio", () => {
    expect(recover("A", 3, null)).toEqual({ kind: "server" });
    expect(
      recover("A", 3, { text: "A", baseRevision: 1, savedAt: "" }),
    ).toEqual({ kind: "server" });
    expect(
      recover("A", 3, { text: "A e mais", baseRevision: 3, savedAt: "" }),
    ).toEqual({ kind: "local", text: "A e mais" });
    expect(
      recover("B", 4, { text: "A e mais", baseRevision: 3, savedAt: "" }),
    ).toEqual({ kind: "conflict", local: "A e mais", server: "B" });
  });
});
