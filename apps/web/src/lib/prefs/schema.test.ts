import { describe, expect, it } from "vitest";
import { prefsSchema, prefsToRow, rowToPrefs } from "./schema";

describe("contrato de preferências", () => {
  it("ida e volta entre app e banco", () => {
    const p = { theme: "dark", reduceMotion: true, textScale: "22" } as const;
    expect(rowToPrefs(prefsToRow(p))).toEqual(p);
  });
  it("rejeita valores fora do contrato", () => {
    expect(prefsSchema.safeParse({ theme: "sepia", reduceMotion: false, textScale: "18" }).success).toBe(false);
    expect(prefsSchema.safeParse({ theme: "light", reduceMotion: false, textScale: "24" }).success).toBe(false);
  });
  it("linha inválida do banco cai no padrão", () => {
    expect(rowToPrefs({ theme: "x", reduced_motion: false, text_scale: 18 })).toEqual({ theme: "system", reduceMotion: false, textScale: "18" });
  });
});
