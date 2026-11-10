import { devices, expect, test } from "@playwright/test";
import { AUTH_FILE } from "./session";
import { VIEWS } from "./views";

/**
 * Celular de referência: iPhone (decisão de Guto). Emulação do iPhone 15 no Chromium
 * (viewport, toque, densidade, user agent do Safari). Não substitui o Safari real nem o VoiceOver:
 * esses ficam no roteiro docs/validation/roteiro-iphone.md.
 */
const { defaultBrowserType: _ignored, ...iphone } = devices["iPhone 15"];
test.use({ ...iphone, storageState: AUTH_FILE });

const MIN_WCAG = 24; // WCAG 2.2, 2.5.8 (AA)
const APPLE = 44; // recomendação de interface da Apple (pt)

for (const view of VIEWS) {
  test(`${view.id} · alvos de toque (iPhone)`, async ({ page }) => {
    await page.goto(view.path);
    await view.open(page);
    const targets = await page.evaluate(() => {
      const sel = 'a[href], button, [role="button"], [role="tab"], input[type="radio"], input[type="checkbox"], input:not([type]), input[type="email"], input[type="password"]';
      return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .map((el) => {
          let box = el.getBoundingClientRect();
          if ((el as HTMLInputElement).type === "radio" || (el as HTMLInputElement).type === "checkbox") {
            const label = el.closest("label");
            if (label) box = label.getBoundingClientRect();
          }
          const style = getComputedStyle(el);
          const inlineText = el.tagName === "A" && style.display === "inline" && !!el.closest("p");
          const insideMark = !!el.closest("[data-anchor]") && el.getAttribute("role") === "button";
          return {
            name: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40),
            w: Math.round(box.width),
            h: Math.round(box.height),
            visible: box.width > 2 && box.height > 2 && style.visibility !== "hidden" && !el.closest("[inert]"),
            exempt: inlineText || insideMark,
          };
        })
        .filter((t) => t.visible);
    });
    const tooSmall = targets.filter((t) => !t.exempt && Math.min(t.w, t.h) < MIN_WCAG);
    const belowApple = targets.filter((t) => !t.exempt && Math.min(t.w, t.h) < APPLE);
    test.info().annotations.push({ type: "abaixo de 44 pt (Apple)", description: belowApple.map((t) => `${t.name} ${t.w}×${t.h}`).join(" · ") || "nenhum" });
    expect(tooSmall.map((t) => `${t.name} ${t.w}×${t.h}`), "alvos menores que 24 px (WCAG 2.5.8)").toEqual([]);
  });
}

test("fluxo por toque: questão → Raio-X", async ({ page }) => {
  await page.goto("/estudar/demonstracao");
  await page.getByText("obriga quem anota").tap();
  await page.getByRole("button", { name: "Confirmar resposta" }).tap();
  await page.getByRole("button", { name: "Ver Raio-X" }).tap();
  await expect(page.getByRole("heading", { name: /Raio-X · Comando/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("fluxo por toque: Hoje → foco → encerrar", async ({ page }) => {
  await page.goto("/hoje");
  await page.locator("[data-hero-start]").tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Encerrar bloco" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
