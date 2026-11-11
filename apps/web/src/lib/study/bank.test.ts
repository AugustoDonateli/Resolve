import { describe, expect, it } from "vitest";
import {
  filterBank,
  options,
  parseFilters,
  recoveries,
  toQuery,
  type BankItem,
} from "./bank";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const item = (
  id: string,
  area: BankItem["area"],
  skills: string[],
  subjects: string[],
  day: number,
  year = 2025,
): BankItem => ({
  itemVersionId: id,
  area,
  skills,
  subjects: subjects.map((s) => ({
    id: s,
    name: s === S1 ? "Funções" : "Ecologia",
  })),
  origins: [{ year, day, booklet: day === 1 ? 1 : 7, color: "Azul", position: 10 }],
  preview: "",
});

const bank = [
  item("a", "MT", ["H21"], [S1], 2),
  item("b", "MT", ["H3"], [S1], 2),
  item("c", "CN", ["H17"], [S2], 2),
  item("d", "LC", ["H18"], [], 1),
  item("e", "MT", ["H21"], [S1], 2, 2024),
];

describe("banco e filtros", () => {
  it("combina filtros sobre os itens publicados", () => {
    expect(filterBank(bank, {}).length).toBe(5);
    expect(
      filterBank(bank, { area: "MT" }).map((i) => i.itemVersionId),
    ).toEqual(["a", "b", "e"]);
    expect(
      filterBank(bank, { area: "MT", year: "2024" }).map((i) => i.itemVersionId),
    ).toEqual(["e"]);
    expect(
      filterBank(bank, { area: "MT", skill: "H21", year: "2025" }).map(
        (i) => i.itemVersionId,
      ),
    ).toEqual(["a"]);
    expect(
      filterBank(bank, { subject: S2, day: "d2" }).map((i) => i.itemVersionId),
    ).toEqual(["c"]);
    expect(filterBank(bank, { day: "d1" }).map((i) => i.itemVersionId)).toEqual(
      ["d"],
    );
  });

  it("combinação vazia sugere qual filtro tirar", () => {
    const f = { area: "LC", skill: "H21" };
    expect(filterBank(bank, f)).toEqual([]);
    expect(recoveries(bank, f)).toEqual([
      { drop: "area", count: 2 },
      { drop: "skill", count: 1 },
    ]);
  });

  it("opções contam dentro dos outros filtros, habilidades em ordem numérica", () => {
    const o = options(bank, { area: "MT" });
    expect(o.skills).toEqual([
      ["H3", 1],
      ["H21", 2],
    ]);
    expect(o.years).toEqual([
      ["2025", 2],
      ["2024", 1],
    ]);
    expect(o.areas.get("CN")).toBe(1); // área ignora o próprio filtro
    expect(o.subjects).toEqual([{ id: S1, name: "Funções", n: 3 }]);
  });

  it("lê e escreve filtros da URL, descartando valores fora do formato", () => {
    expect(
      parseFilters({ area: "MT", habilidade: "H21", assunto: "x", edicao: "24", dia: "d3" }),
    ).toEqual({ area: "MT", skill: "H21", subject: undefined, year: undefined, day: undefined });
    expect(parseFilters({ edicao: "2024" }).year).toBe("2024");
    expect(toQuery({ year: "2024", day: "d2" })).toBe("?edicao=2024&dia=d2");
    expect(toQuery({ area: "MT", subject: S1 })).toBe(`?area=MT&assunto=${S1}`);
    expect(toQuery({})).toBe("");
  });
});
