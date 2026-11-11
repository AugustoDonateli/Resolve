/**
 * Paleta da identidade Mesa: a prova sobre a mesa. A mesa é escura; o conteúdo vive em papel claro,
 * escrito em tinta preta; a caneta azul é a ação; a caneta vermelha é a do corretor (marcas e notas
 * de correção); o marca-texto é preenchimento. Esta é a única fonte de cores do produto.
 *
 * No tema escuro a luminária está apagada: o papel escurece e a tinta clareia. Amarelo e rosa são
 * preenchimentos — nunca cor de texto, número, contorno essencial, cursor ou linha de gráfico.
 */

export type ThemeName = "light" | "dark";

export const colorTokens = {
  desk: { light: "#17191A", dark: "#0C0D0F" },
  "on-desk": { light: "#E9E6DC", dark: "#E9E6DC" },
  "on-desk-secondary": { light: "#A9A69C", dark: "#A9A69C" },
  background: { light: "#EFEEE9", dark: "#20242C" },
  surface: { light: "#FAF9F5", dark: "#2B3039" },
  "surface-subtle": { light: "#E3E1DA", dark: "#343A45" },
  text: { light: "#15171A", dark: "#F7F4ED" },
  "text-secondary": { light: "#585C63", dark: "#B7BDC8" },
  primary: { light: "#2452D1", dark: "#2452D1" },
  "on-primary": { light: "#FFFFFF", dark: "#FFFFFF" },
  "primary-hover": { light: "#1F49BE", dark: "#1F49BE" },
  "primary-pressed": { light: "#1B42AE", dark: "#1B42AE" },
  "link-focus": { light: "#2452D1", dark: "#9FB7FF" },
  correction: { light: "#C4281F", dark: "#FF8A7A" },
  "border-control": { light: "#6E737C", dark: "#8B929E" },
  "border-subtle": { light: "#D5D2C9", dark: "#4A515D" },
  "highlight-yellow": { light: "#F2CA52", dark: "#F2CA52" },
  "highlight-pink": { light: "#E88CAE", dark: "#E88CAE" },
  "on-highlight": { light: "#15171A", dark: "#15171A" },
  "disabled-surface": { light: "#E3E1DA", dark: "#343A45" },
} as const satisfies Record<string, Record<ThemeName, `#${string}`>>;

export type ColorToken = keyof typeof colorTokens;

/** Tinta usada para sombra (8% no claro) e scrim (48% claro / 72% escuro). */
export const INK = "#15171A";

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
  { fg: "on-desk", bg: "desk", kind: "text" },
  { fg: "on-desk-secondary", bg: "desk", kind: "text" },
  { fg: "link-focus", bg: "surface-subtle", kind: "text" },
  { fg: "correction", bg: "background", kind: "text" },
  { fg: "correction", bg: "surface", kind: "text" },
  { fg: "correction", bg: "surface-subtle", kind: "ui" },
];

/** Tipografia (plano §6, "Tipografia, grade e materiais"). Tamanhos em px: [tamanho, altura de linha]. */
export const typeScale = {
  display: { family: "instrument-serif", weight: 400, desktop: [72, 68], mobile: [46, 46] },
  "screen-title": { family: "instrument-serif", weight: 400, desktop: [64, 60], mobile: [44, 44] },
  "section-title": { family: "instrument-serif", weight: 400, desktop: [30, 34], mobile: [26, 30] },
  reading: { family: "newsreader", weight: 400, desktop: [18, 29], mobile: [18, 29] },
  ui: { family: "dm-sans", weight: 500, desktop: [16, 24], mobile: [16, 24] },
  meta: { family: "dm-sans", weight: 400, desktop: [14, 20], mobile: [14, 20] },
  metric: { family: "dm-sans", weight: 500, desktop: [24, 30], mobile: [22, 28], tabular: true },
  kicker: { family: "dm-mono", weight: 500, desktop: [11.5, 16], mobile: [11.5, 16] },
  hand: { family: "caveat", weight: 600, desktop: [24, 26], mobile: [22, 24] },
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const radii = { control: 4, card: 4, panel: 6 } as const;
export const breakpoints = { sm: 640, md: 960, lg: 1200 } as const;
export const layout = { maxWidth: 1240, sidebar: 196, gutter: { desktop: 32, tablet: 24, mobile: 16 } } as const;
