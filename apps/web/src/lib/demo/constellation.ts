/**
 * Constelação como evidência — DADOS DEMONSTRATIVOS (F1-T15, teste R0-P03).
 * Habilidades e tentativas inventadas; os códigos D1–D4 não são da matriz
 * oficial (que depende de EXT-MATRIZ). A regra de suficiência é a do plano §7.
 */

export interface AttemptRef {
  id: string;
  /** Dias atrás (0 = hoje). */
  daysAgo: number;
  item: string;
  correct: boolean;
  help: boolean;
}

export interface SkillNode {
  id: string;
  code: string;
  label: string;
  /** Posição estável no mapa, em % da área. */
  x: number;
  y: number;
  attempts: AttemptRef[];
}

/** Regra inicial configurável (plano §7, domínio por habilidade). */
export const MASTERY_RULE = { minUnassisted: 8, minDistinctItems: 5, minDays: 2, version: "v0-demo" } as const;

export interface SkillEvidence {
  sufficient: boolean;
  unassisted: number;
  withHelp: number;
  distinctItems: number;
  days: number;
  correctUnassisted: number;
  /** Acerto entre tentativas sem ajuda; null quando não há tentativas. */
  accuracy: number | null;
  missing: string[];
}

export function evaluate(attempts: AttemptRef[], rule = MASTERY_RULE): SkillEvidence {
  const free = attempts.filter((a) => !a.help);
  const distinctItems = new Set(free.map((a) => a.item)).size;
  const days = new Set(free.map((a) => a.daysAgo)).size;
  const correct = free.filter((a) => a.correct).length;
  const missing: string[] = [];
  if (free.length < rule.minUnassisted) missing.push(`${rule.minUnassisted - free.length} tentativa(s) sem ajuda`);
  if (distinctItems < rule.minDistinctItems) missing.push(`${rule.minDistinctItems - distinctItems} item(ns) diferente(s)`);
  if (days < rule.minDays) missing.push(`${rule.minDays - days} dia(s) de estudo diferente(s)`);
  return {
    sufficient: missing.length === 0,
    unassisted: free.length,
    withHelp: attempts.length - free.length,
    distinctItems,
    days,
    correctUnassisted: correct,
    accuracy: free.length ? correct / free.length : null,
    missing,
  };
}

function mk(prefix: string, rows: [number, string, boolean, boolean?][]): AttemptRef[] {
  return rows.map(([daysAgo, item, correct, help], i) => ({ id: `${prefix}-${i + 1}`, daysAgo, item, correct, help: help ?? false }));
}

export const demoSkills: SkillNode[] = [
  {
    id: "d1",
    code: "D1",
    label: "Identificar a tese de um texto argumentativo",
    x: 26,
    y: 34,
    attempts: mk("d1", [
      [0, "item 14", true], [0, "item 22", true], [2, "item 31", false], [2, "item 14", true], [5, "item 40", true],
      [5, "item 47", true], [9, "item 52", false], [9, "item 22", true], [12, "item 31", true],
    ]),
  },
  {
    id: "d2",
    code: "D2",
    label: "Relacionar recurso expressivo ao efeito de sentido",
    x: 66,
    y: 24,
    attempts: mk("d2", [
      [1, "item 08", false], [1, "item 11", true], [1, "item 19", false], [4, "item 08", true],
      [4, "item 25", false], [4, "item 29", true], [7, "item 11", false], [7, "item 19", true],
    ]),
  },
  {
    id: "d3",
    code: "D3",
    label: "Inferir informação implícita",
    x: 40,
    y: 72,
    attempts: mk("d3", [
      [0, "item 03", true], [0, "item 05", false], [0, "item 17", true], [0, "item 21", true], [0, "item 03", false],
    ]),
  },
  {
    id: "d4",
    code: "D4",
    label: "Reconhecer a função social de um gênero",
    x: 76,
    y: 66,
    attempts: mk("d4", [
      [1, "item 33", true, true], [1, "item 33", true], [1, "item 36", false], [3, "item 38", true, true], [3, "item 36", true],
      [3, "item 41", true], [6, "item 44", false, true], [6, "item 38", true], [6, "item 41", true], [6, "item 33", false],
    ]),
  },
];

/** As oito referências mais recentes que sustentam o estado do nó. */
export function recentRefs(n: SkillNode, limit = 8): AttemptRef[] {
  return [...n.attempts].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, limit);
}
