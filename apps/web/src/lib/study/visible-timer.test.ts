import { describe, expect, it } from "vitest";
import { VisibleTimer } from "./visible-timer";

describe("tempo visível", () => {
  it("pausa enquanto a página está oculta e retoma ao voltar", () => {
    let t = 1000;
    const timer = new VisibleTimer(() => t);
    t += 8000; // 8 s lendo
    timer.setVisible(false);
    t += 60000; // 1 min em outra aba: não conta
    expect(timer.ms()).toBe(8000);
    timer.setVisible(true);
    t += 5000;
    expect(timer.ms()).toBe(13000);
  });
  it("eventos repetidos não contam duas vezes; começa oculto se a página abriu oculta", () => {
    let t = 0;
    const timer = new VisibleTimer(() => t, false);
    t += 3000;
    timer.setVisible(false);
    timer.setVisible(true);
    timer.setVisible(true);
    t += 2000;
    expect(timer.ms()).toBe(2000);
  });
});
