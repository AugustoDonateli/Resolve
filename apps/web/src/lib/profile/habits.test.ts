import { describe, expect, it } from "vitest";
import { bestPeriod, fmtPace, paceInsight, suggestedTarget, weeksWithHistory, weekTrend, type WeekRow } from "./habits";

const w = (weekStart: string, answers: number, minutes = 0): WeekRow => ({ weekStart, answers, minutes, correct: 0, daysActive: answers ? 1 : 0 });

describe("hábitos de estudo (habitos-v1)", () => {
  it("escreve o tempo por questão", () => {
    expect([45_000, 130_000, 180_000].map(fmtPace)).toEqual(["45 s", "2 min 10 s", "3 min"]);
  });
  it("só comenta tempo e erro com base dos dois lados e diferença grande", () => {
    expect(paceInsight({ nCorrect: 10, nWrong: 10, medianMsCorrect: 100_000, medianMsWrong: 150_000 })).toMatch(/demora mais/);
    expect(paceInsight({ nCorrect: 10, nWrong: 10, medianMsCorrect: 100_000, medianMsWrong: 60_000 })).toMatch(/erra rápido/);
    expect(paceInsight({ nCorrect: 10, nWrong: 10, medianMsCorrect: 100_000, medianMsWrong: 110_000 })).toBeNull();
    expect(paceInsight({ nCorrect: 3, nWrong: 10, medianMsCorrect: 100_000, medianMsWrong: 200_000 })).toBeNull();
  });
  it("alvo de ritmo sugerido sai do tempo típico, dentro de limites", () => {
    expect(suggestedTarget(130_000, 20)).toBe(3);
    expect(suggestedTarget(20_000, 20)).toBe(1);
    expect(suggestedTarget(900_000, 20)).toBe(6);
    expect(suggestedTarget(130_000, 3)).toBeNull();
  });
  it("melhor período: exige base em dois períodos e diferença que valha", () => {
    expect(bestPeriod([{ period: "noite", n: 40, correct: 30 }]).best).toBeNull();
    expect(bestPeriod([{ period: "noite", n: 40, correct: 20 }, { period: "manha", n: 40, correct: 19 }]).text).toMatch(/Sem diferença clara/);
    const r = bestPeriod([{ period: "noite", n: 50, correct: 29 }, { period: "manha", n: 40, correct: 16 }, { period: "tarde", n: 5, correct: 5 }]);
    expect(r).toEqual({ text: "Você acerta mais à noite (58%) do que de manhã (40%).", best: "noite" });
  });
  it("história: corta o começo sem estudo e compara com a semana anterior", () => {
    const weeks = [w("2026-11-16", 26), w("2026-11-09", 79), w("2026-11-02", 0), w("2026-10-26", 0)];
    expect(weeksWithHistory(weeks).map((x) => x.weekStart)).toEqual(["2026-11-16", "2026-11-09"]);
    expect(weeksWithHistory([w("2026-11-16", 0)])).toEqual([]);
    expect(weekTrend(weeks)).toMatch(/^53 respostas a menos/);
    expect(weekTrend([w("2026-11-16", 5), w("2026-11-09", 0)])).toBeNull();
  });
});
