import { describe, expect, it } from "vitest";
import { isRight, parseAnswer } from "./answer";

describe("resposta digitada", () => {
  it("lê números no jeito brasileiro", () => {
    expect(parseAnswer("43,20")).toBe(43.2);
    expect(parseAnswer("R$ 245,20")).toBe(245.2);
    expect(parseAnswer("29 424")).toBe(29424);
    expect(parseAnswer("29.424")).toBe(29424);
    expect(parseAnswer("1.234,5")).toBe(1234.5);
    expect(parseAnswer("4.5")).toBe(4.5);
    expect(parseAnswer("-0,3")).toBe(-0.3);
    expect(parseAnswer("abc")).toBeNull();
    expect(parseAnswer("")).toBeNull();
  });
  it("aceita dentro da tolerância", () => {
    expect(isRight("43,2", 43.2, 0.01)).toBe(true);
    expect(isRight("43", 43.2, 0.01)).toBe(false);
    expect(isRight("2,3", 2.3, 0.05)).toBe(true);
  });
});
