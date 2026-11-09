import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEIGHT, THEMES, VIEWS, WIDTHS } from "./views";

const CAPTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/validation/f1-t08");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollWidth - el.clientWidth;
  });
}

/** Vistas × temas × larguras: sem rolagem horizontal, axe sem violações, captura. */
for (const view of VIEWS) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`${view.id} · ${theme} · ${width}px`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width]! }, colorScheme: theme });
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(view.path);
        await view.open(page);

        expect(await horizontalOverflow(page), "rolagem horizontal da página").toBeLessThanOrEqual(0);

        const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(violations, "violações axe").toEqual([]);
        const incomplete = axe.incomplete.filter((i) => i.id === "color-contrast").reduce((s, i) => s + i.nodes.length, 0);
        test.info().annotations.push({ type: "axe-contraste-a-conferir", description: String(incomplete) });

        expect(errors, "erros de script").toEqual([]);
        if (width === 390 || width === 1440) {
          const fmt = width === 390 ? "celular" : "pc";
          await page.screenshot({ path: path.join(CAPTURES, `${view.id}-${fmt}-${theme === "light" ? "claro" : "escuro"}.png`), fullPage: true });
        }
        await ctx.close();
      });
    }
  }
}

/** Zoom de 200%: 1440 e 1280 px de tela equivalem a 720 e 640 px de CSS. Leitura ampliada a 22 px. */
for (const view of VIEWS) {
  for (const width of [720, 640]) {
    test(`${view.id} · zoom 200% (${width * 2}px)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 450 } });
      const page = await ctx.newPage();
      await page.goto(view.path);
      await view.open(page);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      await expect(page.locator("h1")).toBeVisible();
      if (width === 720) await page.screenshot({ path: path.join(CAPTURES, `${view.id}-zoom200.png`), fullPage: true });
      await ctx.close();
    });
  }
  test(`${view.id} · leitura 22 px em 360px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    await ctx.addInitScript(() => localStorage.setItem("resolve:prefs", JSON.stringify({ theme: "system", reduceMotion: false, textScale: "22" })));
    const page = await ctx.newPage();
    await page.goto(view.path);
    await view.open(page);
    expect(await page.evaluate(() => document.documentElement.dataset.textScale)).toBe("22");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await ctx.close();
  });
}

/**
 * Teclado: percorre a tela com Tab e confere, para cada parada, que o foco
 * não caiu no body, que há indicador visível e que nada fixo o encobre (WCAG 2.4.11).
 */
for (const view of VIEWS) {
  for (const width of [390, 1440]) {
    test(`${view.id} · teclado · ${width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width]! } });
      const page = await ctx.newPage();
      await page.goto(view.path);
      await view.open(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.mouse.click(1, 1);
      const problems: string[] = [];
      for (let i = 0; i < 45; i++) {
        await page.keyboard.press("Tab");
        const r = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return { body: true } as const;
          let target: HTMLElement = el;
          const rect0 = el.getBoundingClientRect();
          // Rádios visualmente ocultos mostram o foco no rótulo.
          if (rect0.width <= 2 || rect0.height <= 2) target = (el.closest("label") as HTMLElement) ?? el;
          const cs = getComputedStyle(target);
          const indicator =
            (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow !== "none" && cs.boxShadow !== "");
          const rect = target.getBoundingClientRect();
          // Alvo que já é fixo (ex.: link "Ir para o conteúdo", z-50) fica acima das barras.
          const selfFixed = getComputedStyle(target).position === "fixed";
          const fixed = selfFixed ? [] : Array.from(document.querySelectorAll<HTMLElement>("header, nav")).filter((n) => {
            const p = getComputedStyle(n).position;
            return (p === "fixed" || p === "sticky") && n.offsetParent !== null && !n.contains(target);
          });
          const covered = fixed.some((n) => {
            const b = n.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) return false;
            const overlapX = Math.min(rect.right, b.right) - Math.max(rect.left, b.left);
            const overlapY = Math.min(rect.bottom, b.bottom) - Math.max(rect.top, b.top);
            // Encoberto quando mais da metade da altura do alvo fica sob a barra.
            return overlapX > 0 && overlapY > rect.height / 2;
          });
          const name = (target.getAttribute("aria-label") || target.textContent || target.tagName).trim().slice(0, 40);
          return { body: false, indicator, covered, name } as const;
        });
        // Voltar ao body encerra o ciclo de Tab (o foco sai para o navegador).
        if (r.body) {
          if (i === 0) problems.push("primeira parada no body");
          break;
        }
        if (!r.indicator) problems.push(`sem indicador visível: ${r.name}`);
        if (r.covered) problems.push(`encoberto por barra fixa: ${r.name}`);
      }
      expect([...new Set(problems)]).toEqual([]);
      await ctx.close();
    });
  }
}

/** Estrutura: um h1, landmark principal e navegações nomeadas. */
for (const view of VIEWS) {
  test(`${view.id} · estrutura`, async ({ page }) => {
    await page.goto(view.path);
    await view.open(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    const navs = await page.locator("nav").evaluateAll((ns) => ns.map((n) => n.getAttribute("aria-label")));
    expect(navs.every(Boolean)).toBe(true);
  });
}
