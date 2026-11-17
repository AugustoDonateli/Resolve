import { describe, expect, it } from "vitest";
import { evolution, fmtStudy, goalProgress, ranking, weekLabel, type WeekMember } from "./week";

const m = (nickname: string, minutes: number | null, sharing = true, daysActive = 1): WeekMember => ({
  nickname, me: false, sharing, minutes, previousMinutes: 0, questions: 0, daysActive, studyingNow: false,
});

describe("placar da semana do grupo", () => {
  it("escreve o tempo sem casas à toa", () => {
    expect([0, 45, 60, 200].map(fmtStudy)).toEqual(["0 min", "45 min", "1 h", "3 h 20 min"]);
  });
  it("compara com a própria semana anterior, e não inventa comparação sem base", () => {
    expect(evolution(200, 120)).toBe("1 h 20 min a mais que na semana passada");
    expect(evolution(30, 90)).toBe("1 h a menos que na semana passada");
    expect(evolution(60, 60)).toBe("igual à semana passada");
    expect(evolution(0, 0)).toBeNull();
    expect(evolution(null, 10)).toBeNull();
  });
  it("só entra no ranking quem escolheu participar; empate vai para quem estudou em mais dias", () => {
    const r = ranking([m("Bia", 90, true, 1), m("Caio", 300, false), m("Ana", 90, true, 3), m("Davi", 120)]);
    expect(r.map((x) => x.nickname)).toEqual(["Davi", "Ana", "Bia"]);
  });
  it("meta coletiva e rótulo da semana", () => {
    expect(goalProgress(300, 600)).toBe(0.5);
    expect(goalProgress(900, 600)).toBe(1);
    expect(goalProgress(10, null)).toBeNull();
    expect(weekLabel("2026-11-16")).toBe("16/11 a 22/11");
    expect(weekLabel("2026-12-28")).toBe("28/12 a 03/01");
  });
});
