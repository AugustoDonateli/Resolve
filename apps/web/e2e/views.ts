import type { Page } from "@playwright/test";

/** As três situações da F1-T08: questão longa, correção e rotina. */
export interface View {
  id: string;
  label: string;
  path: string;
  /** Leva a tela ao estado mais denso que a situação exibe. */
  open: (page: Page) => Promise<void>;
}

export const VIEWS: View[] = [
  {
    id: "questao",
    label: "Questão longa com Raio-X",
    path: "/estudar/demonstracao",
    open: async (page) => {
      await page.getByText("obriga quem anota").click();
      await page.getByRole("button", { name: "Confirmar resposta" }).click();
      await page.getByRole("button", { name: "Ver Raio-X" }).click();
      await page.getByRole("button", { name: "Mostrar tudo" }).click();
      await page.waitForTimeout(900);
    },
  },
  {
    id: "correcao",
    label: "Correção por competência",
    path: "/redacao/demonstracao",
    open: async (page) => {
      await page.getByRole("tab", { name: /C3/ }).click();
      await page.waitForTimeout(900);
    },
  },
  {
    id: "rotina",
    label: "Hoje e agenda",
    path: "/hoje",
    open: async (page) => {
      // Dados reais da conta de teste: com ou sem plano montado, a seção do plano sempre aparece.
      await page.waitForSelector("#plano-hoje");
      await page.waitForTimeout(300);
    },
  },
];

export const THEMES = ["light", "dark"] as const;
/** Larguras de G4. 390 e 1440 são os dois formatos das 12 vistas. */
export const WIDTHS = [360, 390, 768, 1440] as const;
export const HEIGHT: Record<number, number> = { 360: 780, 390: 844, 768: 1024, 1440: 900 };
