import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInZone,
  dayLabel,
  groupByDay,
  hhmm,
  occurrenceRange,
  scheduleError,
  timeRangeProblem,
  weekdayOf,
  type Occurrence,
} from "./schedule-types";

const occ = (local_start: string, local_end: string): Occurrence => ({
  kind: "compromisso",
  source: "regra",
  source_id: "x",
  rule_id: "x",
  title: "Aula",
  starts_at: "",
  ends_at: "",
  local_start,
  local_end,
  changed: false,
});

describe("datas e horários", () => {
  it("formata horas", () => {
    expect(hhmm("19:00:00")).toBe("19:00");
    expect(hhmm("2026-11-16T07:30:00")).toBe("07:30");
  });
  it("soma dias atravessando mês e ano", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("dia da semana e rótulo", () => {
    expect(weekdayOf("2026-11-16")).toBe(1);
    expect(dayLabel("2026-11-16")).toBe("seg., 16/11");
  });
  it("data no fuso: o mesmo instante cai em dias diferentes", () => {
    const t = "2026-11-16T22:00:00Z"; // 19h em São Paulo, 7h do dia 17 em Tóquio
    expect(dateInZone(t, "America/Sao_Paulo")).toBe("2026-11-16");
    expect(dateInZone(t, "Asia/Tokyo")).toBe("2026-11-17");
  });
  it("intervalo que termina no dia seguinte (fuso de quem vê)", () => {
    expect(
      occurrenceRange(occ("2026-11-16T19:00:00", "2026-11-16T20:00:00")),
    ).toBe("19:00–20:00");
    expect(
      occurrenceRange(occ("2026-11-16T23:30:00", "2026-11-17T00:30:00")),
    ).toBe("23:30–00:30 (dia seguinte)");
  });
  it("agrupa por dia e mantém dias vazios", () => {
    const g = groupByDay(
      ["2026-11-16", "2026-11-17"],
      [occ("2026-11-16T19:00:00", "2026-11-16T20:00:00")],
    );
    expect(g.get("2026-11-16")).toHaveLength(1);
    expect(g.get("2026-11-17")).toEqual([]);
  });
});

describe("validação e erros", () => {
  it("intervalo no mesmo dia", () => {
    expect(timeRangeProblem("19:00", "20:00")).toBeNull();
    expect(timeRangeProblem("20:00", "19:00")).toMatch(/depois do início/);
    expect(timeRangeProblem("20:00", "20:00")).toMatch(/depois do início/);
    expect(timeRangeProblem("7:00", "08:00")).toMatch(/formato/);
  });
  it("conflito usa a dica do banco", () => {
    const hint =
      "Colide com o compromisso Aula de inglês em 16/11/2026, das 19:00 às 20:00.";
    expect(scheduleError("resolve_schedule_conflict", hint)).toBe(hint);
    expect(
      scheduleError(
        'duplicate key value violates unique constraint "schedule_exceptions_one_per_occurrence"',
      ),
    ).toMatch(/já tem uma mudança/);
    expect(scheduleError("qualquer outra coisa")).toMatch(/Tente de novo/);
  });
});
