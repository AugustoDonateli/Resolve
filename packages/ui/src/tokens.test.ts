import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { colorTokens, fillOnlyTokens, usedPairs, type ThemeName } from "./tokens";
import { composite, contrastRatio } from "./contrast";
import { bezierFn, ease } from "./motion";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function cssBlock(selector: string): string {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`Seletor ausente: ${selector}`);
  const start = css.indexOf("{", i);
  let depth = 0;
  for (let j = start; j < css.length; j++) {
    if (css[j] === "{") depth++;
    if (css[j] === "}") depth--;
    if (depth === 0) return css.slice(start, j);
  }
  throw new Error("Bloco sem fechamento");
}

function cssVar(block: string, name: string): string | undefined {
  const m = new RegExp(`--rs-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
  return m?.[1]?.toUpperCase();
}

describe("paleta Caderno de Prova", () => {
  it("reproduz os contrastes declarados no plano (§6)", () => {
    const c = colorTokens;
    const r = (a: string, b: string) => Math.round(contrastRatio(a, b) * 100) / 100;
    expect(r(c.text.light, c.background.light)).toBeCloseTo(14.16, 1);
    expect(r(c["text-secondary"].light, c.background.light)).toBeCloseTo(5.16, 1);
    expect(r(c.text.dark, c.background.dark)).toBeCloseTo(14.16, 1);
    expect(r(c["text-secondary"].dark, c.surface.dark)).toBeCloseTo(7.02, 1);
    expect(r(c["on-primary"].light, c.primary.light)).toBeCloseTo(6.56, 1);
    expect(r(c["link-focus"].dark, c.surface.dark)).toBeCloseTo(6.75, 1);
    expect(r(c["on-highlight"].light, c["highlight-yellow"].light)).toBeCloseTo(9.88, 1);
    expect(r(c["on-highlight"].light, c["highlight-pink"].light)).toBeCloseTo(6.51, 1);
    expect(r(c["border-control"].light, c.surface.light)).toBeCloseTo(4.38, 1);
    expect(r(c["border-control"].dark, c.surface.dark)).toBeCloseTo(4.23, 1);
  });

  for (const theme of ["light", "dark"] as ThemeName[]) {
    it(`todos os pares usados passam no tema ${theme}`, () => {
      for (const p of usedPairs) {
        if (p.themes && !p.themes.includes(theme)) continue;
        const ratio = contrastRatio(colorTokens[p.fg][theme], colorTokens[p.bg][theme]);
        const min = p.kind === "text" ? 4.5 : 3;
        expect(ratio, `${p.fg} sobre ${p.bg} (${theme}) = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it("amarelo e rosa nunca aparecem como texto nos pares", () => {
    for (const p of usedPairs) expect(fillOnlyTokens).not.toContain(p.fg);
  });

  it("marca-texto translúcido mantém tinta legível (destaque de evidência a 55%)", () => {
    for (const bg of [colorTokens.surface.light, colorTokens.background.light]) {
      const mixed = composite(colorTokens["highlight-yellow"].light, 0.55, bg);
      expect(contrastRatio(colorTokens["on-highlight"].light, mixed)).toBeGreaterThan(4.5);
    }
  });

  it("tokens.css espelha tokens.ts nos dois temas", () => {
    const light = cssBlock(":root {");
    const dark = cssBlock(':root[data-theme="dark"]');
    for (const [name, v] of Object.entries(colorTokens)) {
      expect(cssVar(light, name), `claro ${name}`).toBe(v.light);
      const d = cssVar(dark, name) ?? cssVar(light, name);
      expect(d, `escuro ${name}`).toBe(v.dark);
    }
  });
});

describe("curvas de movimento", () => {
  it("bezierFn começa em 0, termina em 1 e é monotônica para as curvas do §8", () => {
    for (const b of Object.values(ease)) {
      const f = bezierFn(b);
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      let prev = 0;
      for (let t = 0.05; t < 1; t += 0.05) {
        const y = f(t);
        expect(y).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = y;
      }
    }
  });
});
