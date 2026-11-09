import { describe, expect, it } from "vitest";
import { canPlace, demoDay, fmtClock, freeSlots } from "./routine";

describe("remarcação (regra única do gesto e do formulário)", () => {
  const now = new Date(2026, 10, 9, 13, 50);
  const { blocks, gridStart, gridEnd } = demoDay(now);

  it("recusa sobreposição com compromisso fixo", () => {
    const fixed = blocks.find((b) => b.fixed)!;
    const r = canPlace(blocks, "b1", fixed.start, gridStart, gridEnd);
    expect(r.ok).toBe(false);
  });

  it("recusa mover compromisso fixo", () => {
    expect(canPlace(blocks, "fx", gridStart, gridStart, gridEnd).ok).toBe(false);
  });

  it("aceita horário livre e todos os horários oferecidos são válidos", () => {
    const slots = freeSlots(blocks, "b1", gridStart, gridEnd);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(canPlace(blocks, "b1", s, gridStart, gridEnd).ok).toBe(true);
  });

  it("recusa horário fora do dia planejado", () => {
    expect(canPlace(blocks, "b1", gridEnd, gridStart, gridEnd).ok).toBe(false);
  });

  it("formata relógio com 24 h", () => {
    expect(fmtClock(13 * 60 + 5)).toBe("13:05");
    expect(fmtClock(24 * 60 + 15)).toBe("00:15");
  });
});
