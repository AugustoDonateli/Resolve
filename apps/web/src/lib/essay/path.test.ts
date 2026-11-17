import { describe, expect, it } from "vitest";
import { currentEssayStep, essayName } from "./path";

describe("caminho da redação", () => {
  it("dá nome a cada folha: tema, começo do texto ou folha em branco", () => {
    expect(essayName({ promptTitle: "Desafios da educação", preview: "x" })).toBe("Desafios da educação");
    expect(essayName({ promptTitle: null, preview: "  \n " })).toBe("Folha em branco");
    expect(essayName({ promptTitle: null, preview: "A leitura no Brasil" })).toBe("Tema livre: “A leitura no Brasil”");
    const long = essayName({ promptTitle: null, preview: "A persistência da violência contra a mulher na sociedade brasileira é um problema" });
    expect(long.endsWith("…”")).toBe(true);
    expect(long.length).toBeLessThan(64);
    expect(long).not.toMatch(/\s…/);
  });

  it("acha o passo atual pela redação mais recente", () => {
    expect(currentEssayStep(undefined)).toMatchObject({ step: "tema", href: "/redacao/temas" });
    expect(currentEssayStep({ id: "a", promptTitle: null, status: "rascunho", preview: "" })).toMatchObject({ step: "escrever", href: "/redacao/escrever/a" });
    expect(currentEssayStep({ id: "b", promptTitle: null, status: "submetida", preview: "" })).toMatchObject({ step: "correcao", href: "/redacao/correcao/b" });
  });
});
