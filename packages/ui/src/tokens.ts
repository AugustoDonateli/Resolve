/**
 * Paleta da identidade Caderno de Prova (plano §6, "Paleta completa de interface").
 * Esta é a única fonte de cores do produto. Gráficos, régua, constelação e replay
 * herdam estes tokens; não existe paleta paralela de status.
 *
 * O escuro deriva da tinta (#20242C). Amarelo e rosa são preenchimentos — nunca
 * cor de texto, número, contorno essencial, cursor ou linha de gráfico.
 */

export type ThemeName = "light" | "dark";

export const colorTokens = {
  background: { light: "#F7F4ED", dark: "#20242C" },
  surface: { light: "#FFFFFF", dark: "#2B3039" },
  "surface-subtle": { light: "#EEEAE1", dark: "#343A45" },
  text: { light: "#20242C", dark: "#F7F4ED" },
  "text-secondary": { light: "#626772", dark: "#B7BDC8" },
  primary: { light: "#2452D1", dark: "#2452D1" },
  "on-primary": { light: "#FFFFFF", dark: "#FFFFFF" },
  "primary-hover": { light: "#1F49BE", dark: "#1F49BE" },
  "primary-pressed": { light: "#1B42AE", dark: "#1B42AE" },
  "link-focus": { light: "#2452D1", dark: "#9FB7FF" },
  "border-control": { light: "#737984", dark: "#8B929E" },
  "border-subtle": { light: "#DAD6CC", dark: "#4A515D" },
  "highlight-yellow": { light: "#F2CA52", dark: "#F2CA52" },
  "highlight-pink": { light: "#E88CAE", dark: "#E88CAE" },
  "on-highlight": { light: "#20242C", dark: "#20242C" },
  "disabled-surface": { light: "#EEEAE1", dark: "#343A45" },
} as const satisfies Record<string, Record<ThemeName, `#${string}`>>;

export type ColorToken = keyof typeof colorTokens;

/** Tinta usada para sombra (8% no claro) e scrim (48% claro / 72% escuro). */
export const INK = "#20242C";

/** Tokens que só podem ser usados como preenchimento (nunca como texto/linha). */
export const fillOnlyTokens: readonly ColorToken[] = ["highlight-yellow", "highlight-pink"];

/**
 * Pares texto/fundo que a interface usa de fato. O teste de contraste percorre
 * esta lista nos dois temas; ao criar um novo par na UI, acrescente-o aqui.
 * kind "text" exige 4,5:1; kind "ui" (bordas e indicadores essenciais) exige 3:1.
 */
export const usedPairs: ReadonlyArray<{
  fg: ColorToken;
  bg: ColorToken;
  kind: "text" | "ui";
  themes?: readonly ThemeName[];
}> = [
  { fg: "text", bg: "background", kind: "text" },
  { fg: "text", bg: "surface", kind: "text" },
  { fg: "text", bg: "surface-subtle", kind: "text" },
  { fg: "text-secondary", bg: "background", kind: "text" },
  { fg: "text-secondary", bg: "surface", kind: "text" },
  { fg: "text-secondary", bg: "surface-subtle", kind: "text" },
  { fg: "on-primary", bg: "primary", kind: "text" },
  { fg: "on-primary", bg: "primary-hover", kind: "text" },
  { fg: "on-primary", bg: "primary-pressed", kind: "text" },
  { fg: "link-focus", bg: "background", kind: "text" },
  { fg: "link-focus", bg: "surface", kind: "text" },
  { fg: "on-highlight", bg: "highlight-yellow", kind: "text" },
  { fg: "on-highlight", bg: "highlight-pink", kind: "text" },
  { fg: "border-control", bg: "surface", kind: "ui" },
  { fg: "border-control", bg: "background", kind: "ui" },
  { fg: "link-focus", bg: "surface", kind: "ui" },
  { fg: "primary", bg: "surface", kind: "ui", themes: ["light"] },
];

/** Tipografia (plano §6, "Tipografia, grade e materiais"). Tamanhos em px: [tamanho, altura de linha]. */
export const typeScale = {
  display: { family: "newsreader", weight: 500, desktop: [48, 52], mobile: [34, 39] },
  "screen-title": { family: "dm-sans", weight: 600, desktop: [30, 36], mobile: [24, 30] },
  "section-title": { family: "dm-sans", weight: 600, desktop: [22, 28], mobile: [20, 26] },
  reading: { family: "dm-sans", weight: 400, desktop: [18, 29], mobile: [18, 29] },
  ui: { family: "dm-sans", weight: 500, desktop: [16, 24], mobile: [16, 24] },
  meta: { family: "dm-sans", weight: 400, desktop: [14, 20], mobile: [14, 20] },
  metric: { family: "dm-sans", weight: 500, desktop: [24, 30], mobile: [22, 28], tabular: true },
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const radii = { control: 8, card: 12, panel: 16 } as const;
export const breakpoints = { sm: 640, md: 960, lg: 1200 } as const;
export const layout = { maxWidth: 1280, sidebar: 216, gutter: { desktop: 32, tablet: 24, mobile: 16 } } as const;
