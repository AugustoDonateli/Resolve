import { describe, expect, it } from "vitest";
import { daysUntil, inFinalStretch } from "./exam";

describe("reta final", () => {
  it("conta dias de calendário, sem depender de fuso nem de horário de verão", () => {
    expect(daysUntil("2026-11-10", "2026-11-10")).toBe(0);
    expect(daysUntil("2026-11-10", "2027-11-07")).toBe(362);
    expect(daysUntil("2027-02-28", "2027-03-01")).toBe(1);
  });
  it("vale nos 60 dias antes do 1º dia, inclusive o próprio dia; não depois da prova", () => {
    expect(inFinalStretch(60)).toBe(true);
    expect(inFinalStretch(0)).toBe(true);
    expect(inFinalStretch(61)).toBe(false);
    expect(inFinalStretch(-1)).toBe(false);
    expect(inFinalStretch(null)).toBe(false);
  });
});
