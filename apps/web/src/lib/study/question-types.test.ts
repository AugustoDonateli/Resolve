import { describe, expect, it } from "vitest";
import { fromProposal, fromStudyItem, missingAlt } from "./question-types";

const proposal = {
  area: "CN" as const,
  number: 119,
  source: { day: 2, booklet: 7 },
  stimulus_blocks: [
    { id: "s1", type: "paragraph", text: "Texto-base." },
    { id: "fig1b", type: "image", asset_ref: "fig1" },
    { id: "x", type: "desconhecido", text: "ignorado" },
  ],
  command_blocks: [{ id: "c1", type: "paragraph", text: "O diagrama é:" }],
  alternatives: Object.fromEntries(
    ["A", "B", "C", "D", "E"].map((l, i) => [
      l,
      [{ id: `a${l}`, type: "image", asset_ref: `fig${i + 2}` }],
    ]),
  ),
  figures: [
    { id: "fig1", alt_text: "Gerador com 40 V." },
    { id: "fig2", alt_text: "  " },
  ],
};

describe("questão para exibição", () => {
  it("proposta: blocos, figuras com link e texto alternativo, cinco alternativas", () => {
    const q = fromProposal(proposal, {
      fig1: "https://x/fig1.png",
      fig2: "https://x/fig2.png",
    });
    expect(q.origin).toBe("Enem · Dia 2 · Caderno 7 · Questão 119");
    expect(q.stimulus.map((b) => b.type)).toEqual(["paragraph", "image"]);
    expect(q.stimulus[1]!.figure).toEqual({
      url: "https://x/fig1.png",
      alt: "Gerador com 40 V.",
    });
    expect(q.alternatives.map((a) => a.letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(q.alternatives[0]!.blocks[0]!.figure).toEqual({
      url: "https://x/fig2.png",
      alt: null,
    });
    expect(q.alternatives[1]!.blocks[0]!.figure).toEqual({
      url: null,
      alt: null,
    });
    expect(missingAlt(q)).toBe(5);
  });

  it("publicada: figura pelo asset, letras na ordem das chaves, sem gabarito", () => {
    const q = fromStudyItem(
      {
        item_version_id: "v",
        area: "LC",
        stimulus_blocks: null,
        command_blocks: [
          { id: "c1", type: "paragraph", text: "Comando" },
          { id: "i", type: "image", asset_ref: "f", asset_id: "u1" },
        ],
        alternatives: ["E", "C", "A", "D", "B"].map((k) => ({
          key: k,
          content_blocks: [{ id: k, type: "paragraph", text: k }],
        })),
        appearances: [{ booklet: 1, day: 1, color: "Azul", position: 10 }],
      },
      { u1: { url: "https://x/u1.png", alt: "Figura." } },
    );
    expect(q.stimulus).toEqual([]);
    expect(q.command[1]!.figure).toEqual({
      url: "https://x/u1.png",
      alt: "Figura.",
    });
    expect(q.alternatives.map((a) => `${a.letter}${a.key}`)).toEqual([
      "AA",
      "BB",
      "CC",
      "DD",
      "EE",
    ]);
    expect(q.origin).toBe("Enem · Dia 1 · Caderno 1 (Azul) · Questão 10");
    expect(JSON.stringify(q)).not.toMatch(/correct/);
  });
});
