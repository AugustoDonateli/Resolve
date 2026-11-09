import { describe, expect, it } from "vitest";
import { applyEdit, changedFields, editSchema, textProblem, type ProposalPayload } from "./payload";

const base: ProposalPayload = {
  contract: "item-proposal/v1",
  source: { booklet_file: "2025_PV_impresso_D2_CD7.pdf", booklet_sha256: "a".repeat(64), day: 2, booklet: 7, pages: [18], bbox_by_page: { "18": [50, 100, 300, 400] } },
  number: 140,
  foreign_language: null,
  area: "MT",
  stimulus_blocks: [{ id: "s1", type: "paragraph", text: "Em um laboratório, há 5 L." }],
  command_blocks: [{ id: "c1", type: "paragraph", text: "Qual é a quantidade?" }],
  alternatives: {
    A: [{ id: "aa", type: "paragraph", text: "0,0050" }],
    B: [{ id: "ab", type: "paragraph", text: "0,0100" }],
    C: [{ id: "ac", type: "paragraph", text: "0,5000" }],
    D: [{ id: "ad", type: "paragraph", text: "4,9775" }],
    E: [{ id: "ae", type: "image", asset_ref: "fig1" }],
  },
  figures: [{ id: "fig1", role: "alternativa E", kind: "imagem", page: 18, bbox_pt: [60, 300, 200, 380], png_sha256: "b".repeat(64) }],
  producer: { kind: "extrator", tool: "tools/ingest/extract.py", version: "0.1" },
  doubts: [],
};

const edit = (patch: Record<string, unknown> = {}) => ({
  proposalId: "4f8a0c3e-2b1d-4e5f-8a9b-0c1d2e3f4a5b",
  expectedRevision: 0,
  note: "corrigido conforme o PDF",
  stimulus_blocks: base.stimulus_blocks,
  command_blocks: base.command_blocks,
  alternatives: base.alternatives,
  figures: base.figures,
  ...patch,
});

describe("texto seguro (mesmas regras do banco)", () => {
  it("recusa HTML, script e caracteres de controle", () => {
    expect(textProblem("<img src=x onerror=alert(1)>")).not.toBeNull();
    expect(textProblem("veja javascript:alert(1)")).not.toBeNull();
    expect(textProblem("&lt;script&gt;")).not.toBeNull();
    expect(textProblem("a‮b")).not.toBeNull();
    expect(textProblem("a\u0007b")).not.toBeNull();
  });
  it("aceita matemática com < e >", () => {
    expect(textProblem("Se 2 < x e x > 1, então")).toBeNull();
    expect(textProblem("Vale a < b < c para todo n > 0?")).toBeNull();
  });
});

describe("correção do editor", () => {
  it("valida a entrada e exige nota", () => {
    expect(editSchema.safeParse(edit()).success).toBe(true);
    expect(editSchema.safeParse(edit({ note: "  " })).success).toBe(false);
    const bad = edit({ command_blocks: [{ id: "c1", type: "paragraph", text: "x <script>alert(1)</script>" }] });
    expect(editSchema.safeParse(bad).success).toBe(false);
  });

  it("recusa caixa de figura invertida e bloco com chave desconhecida", () => {
    expect(editSchema.safeParse(edit({ figures: [{ ...base.figures[0], bbox_pt: [200, 300, 60, 380] }] })).success).toBe(false);
    expect(editSchema.safeParse(edit({ command_blocks: [{ id: "c1", type: "paragraph", text: "ok", onclick: "x" }] })).success).toBe(false);
  });

  it("não altera identidade nem origem da questão", () => {
    const parsed = editSchema.parse(edit({ command_blocks: [{ id: "c1", type: "paragraph", text: "Qual é a quantidade, em litro?" }] }));
    const next = applyEdit(base, parsed);
    expect(next.source).toEqual(base.source);
    expect([next.number, next.area, next.foreign_language, next.contract]).toEqual([140, "MT", null, "item-proposal/v1"]);
    expect(changedFields(base, next)).toEqual(["comando"]);
  });

  it("caixa corrigida marca novo recorte pendente", () => {
    const parsed = editSchema.parse(edit({ figures: [{ ...base.figures[0], bbox_pt: [58, 296, 204, 384], alt_text: "Gráfico de barras" }] }));
    const next = applyEdit(base, parsed);
    expect(next.figures[0]?.recrop_pending).toBe(true);
    expect(changedFields(base, next)).toEqual(["figura fig1: caixa", "figura fig1: texto alternativo"]);
  });

  it("ordem das chaves (jsonb do banco × formulário) não conta como mudança", () => {
    const fromDb = JSON.parse(JSON.stringify(base), (_k, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
    ) as ProposalPayload;
    const parsed = editSchema.parse(edit({ command_blocks: [{ id: "c1", type: "paragraph", text: "Qual é a quantidade, em litro?" }] }));
    expect(changedFields(fromDb, applyEdit(fromDb, parsed))).toEqual(["comando"]);
  });

  it("lista blocos incluídos, removidos e alternativas alteradas", () => {
    const parsed = editSchema.parse(
      edit({
        stimulus_blocks: [{ id: "s2", type: "paragraph", text: "Parágrafo que faltava." }],
        alternatives: { ...base.alternatives, C: [{ id: "ac", type: "paragraph", text: "0,0500" }] },
      }),
    );
    expect(changedFields(base, applyEdit(base, parsed))).toEqual(["texto-base: bloco s1 removido", "texto-base: bloco s2 incluído", "alternativa C"]);
  });
});
