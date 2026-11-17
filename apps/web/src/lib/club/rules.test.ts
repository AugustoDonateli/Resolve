import { describe, expect, it } from "vitest";
import { confirmsDeletion, inviteLink, normalizeCode, quotaState, usd } from "./rules";

describe("clube", () => {
  it("escreve valores em dólar no formato brasileiro", () => {
    expect(usd(1.5)).toBe("US$ 1,50");
    expect(usd(0)).toBe("US$ 0,00");
    expect(usd(10)).toBe("US$ 10,00");
  });
  it("cota: soma o reservado ao consumido e avisa aos 70%", () => {
    expect(quotaState({ limitUsd: 1.5, warnRatio: 0.7, consumedUsd: 0, reservedUsd: 0 })).toEqual({ used: 0, share: 0, level: "ok" });
    expect(quotaState({ limitUsd: 1.5, warnRatio: 0.7, consumedUsd: 0.9, reservedUsd: 0.2 }).level).toBe("aviso");
    expect(quotaState({ limitUsd: 1.5, warnRatio: 0.7, consumedUsd: 1.6, reservedUsd: 0 })).toMatchObject({ share: 1, level: "esgotada" });
  });
  it("link e código do convite", () => {
    expect(inviteLink("https://resolve.app/", "ABCDEFGH23")).toBe("https://resolve.app/convite/ABCDEFGH23");
    expect(normalizeCode(" abcd-efgh 23 ")).toBe("ABCDEFGH23");
  });
  it("só exclui com a palavra certa", () => {
    expect(confirmsDeletion(" excluir ")).toBe(true);
    expect(confirmsDeletion("excluir conta")).toBe(false);
    expect(confirmsDeletion("")).toBe(false);
  });
});
