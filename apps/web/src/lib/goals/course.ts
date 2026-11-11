export const PARTS = ["LC", "CH", "CN", "MT", "RED"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABEL: Record<Part, string> = {
  LC: "Linguagens",
  CH: "Ciências Humanas",
  CN: "Ciências da Natureza",
  MT: "Matemática",
  RED: "Redação",
};

export interface CourseGoal {
  id: string;
  course: string;
  institution: string;
  modality: string | null;
  cutoff: number | null;
  weights: Partial<Record<Part, number>> | null;
  source: string | null;
}

/** Peso de cada parte: o informado, ou 1 quando a meta não traz pesos (média simples). */
export function weightOf(goal: Pick<CourseGoal, "weights">, p: Part): number {
  return goal.weights?.[p] ?? 1;
}

/** Média ponderada das notas informadas; null se faltar alguma das cinco. */
export function weightedAverage(scores: Partial<Record<Part, number>>, goal: Pick<CourseGoal, "weights">): number | null {
  let num = 0;
  let den = 0;
  for (const p of PARTS) {
    const s = scores[p];
    if (s === undefined || Number.isNaN(s)) return null;
    num += weightOf(goal, p) * s;
    den += weightOf(goal, p);
  }
  return den > 0 ? num / den : null;
}

/**
 * Nota que falta numa parte para a média ponderada chegar à nota de corte, com as outras quatro fixas.
 * `needed` acima de 1000 quer dizer que só essa parte não basta; abaixo de 0, que já passou.
 */
export function neededIn(
  part: Part,
  scores: Partial<Record<Part, number>>,
  goal: Pick<CourseGoal, "weights" | "cutoff">,
): { needed: number } | null {
  if (goal.cutoff === null) return null;
  let den = 0;
  let rest = 0;
  for (const p of PARTS) {
    den += weightOf(goal, p);
    if (p === part) continue;
    const s = scores[p];
    if (s === undefined || Number.isNaN(s)) return null;
    rest += weightOf(goal, p) * s;
  }
  return { needed: (goal.cutoff * den - rest) / weightOf(goal, part) };
}
