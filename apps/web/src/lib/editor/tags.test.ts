import { describe, expect, it } from "vitest";
import { cleanTags, locateQuote, tagsSchema, type Tags } from "./tags";

const base: Tags = {
  skill: { code: "H18" },
  secondary_skill: null,
  content_dependency: 1,
  subjects: { ids: [], absent_reason: "Taxonomia de assuntos ainda não carregada no Resolve." },
  evidence: [{ type: "text", block_id: "c1", start_utf16: 33, end_utf16: 61, quote: "síntese da opinião da autora", rationale: "O comando pede a síntese." }],
  evidence_absent_reason: "",
  distractors: [{ letter: "A", type: "reducao", secondary_type: null, rationale: "Recurso presente que não marca a síntese." }],
  explanation: { steps: [{ id: "p1", text: "" }], absent_reason: "Resolução no próximo lote." },
};

describe("trecho de evidência", () => {
  const text = "O recurso linguístico usado para marcar a síntese da opinião da autora foi o(a)";
  it("localiza com offsets UTF-16", () => {
    const r = locateQuote(text, "síntese da opinião da autora");
    expect(r).toEqual({ start: text.indexOf("síntese"), end: text.indexOf("síntese") + "síntese da opinião da autora".length });
  });
  it("conta caractere fora do plano básico como 2 unidades (igual ao banco)", () => {
    const t = "Fórmula 𝑥² e depois o trecho";
    const r = locateQuote(t, "o trecho");
    expect(r).toEqual({ start: t.length - "o trecho".length, end: t.length });
    expect("𝑥".length).toBe(2);
  });
  it("recusa trecho ausente ou repetido", () => {
    expect(locateQuote(text, "frase inventada")).toHaveProperty("error");
    expect(locateQuote("a b a b", "a b")).toEqual({ error: "O trecho aparece mais de uma vez no bloco: inclua mais palavras." });
    expect(locateQuote(text, "  ")).toHaveProperty("error");
  });
});

describe("formato das etiquetas", () => {
  it("aceita o formato completo e descarta passos vazios", () => {
    expect(tagsSchema.safeParse(base).success).toBe(true);
    expect(cleanTags(base).explanation.steps).toEqual([]);
  });
  it("recusa HTML em justificativa e código de habilidade fora do padrão", () => {
    expect(tagsSchema.safeParse({ ...base, evidence_absent_reason: "<script>alert(1)</script>" }).success).toBe(false);
    expect(tagsSchema.safeParse({ ...base, skill: { code: "habilidade 1" } }).success).toBe(false);
    expect(tagsSchema.safeParse({ ...base, distractors: [{ ...base.distractors[0], rationale: "x onclick=alert(1)" }] }).success).toBe(false);
  });
});
