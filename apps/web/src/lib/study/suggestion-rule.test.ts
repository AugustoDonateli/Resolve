import { describe, expect, it } from "vitest";
import { pickSuggestion } from "./suggestion-rule";

describe("sugestão para agora (sugestao-v1)", () => {
  const focus = { area: "MT" as const, reason: "12 erros em 20 respostas nos últimos 14 dias (60%): a maior taxa entre as áreas com respostas suficientes." };
  it("fichas vencidas vêm antes de tudo", () => {
    const s = pickSuggestion({ reviewDue: 3, focus });
    expect(s.kind).toBe("revisar");
    expect(s.title).toBe("Revisar 3 fichas");
    expect(pickSuggestion({ reviewDue: 1, focus: null }).title).toBe("Revisar 1 ficha");
  });
  it("sem fichas, a área do plano adaptativo, com o motivo dele", () => {
    const s = pickSuggestion({ reviewDue: 0, focus });
    expect(s).toMatchObject({ kind: "area", title: "Treinar Matemática", reason: focus.reason, href: "/estudar?area=MT#treino" });
  });
  it("sem histórico nem fichas (ou contagem indisponível), treino livre", () => {
    expect(pickSuggestion({ reviewDue: null, focus: null }).kind).toBe("livre");
  });
});
