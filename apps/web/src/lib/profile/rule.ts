/**
 * Perfil de aprendizado (`perfil-v1`, regra da plataforma): compara o acerto da conta com o acerto médio
 * de quem fez o Enem nas mesmas questões (microdados do Inep). Só classifica com respostas suficientes;
 * antes disso diz quantas faltam. Nada aqui mede vocação: mostra como a pessoa está hoje.
 */

export interface Tally {
  answers: number;
  correct: number;
  /** Respostas em questões com taxa de acerto do Inep, e a soma dessas taxas (acertos esperados). */
  withBrazil: number;
  brazilSum: number;
  correctWithBrazil: number;
}

export type Level = "bem" | "media" | "reforco";
export const PROFILE_RULE = { id: "perfil-v1", minArea: 10, minTheme: 5, margin: 0.1 } as const;

export interface Reading {
  level: Level | null;
  /** Frase curta: "Você vai bem", "Na média", "Precisa de reforço" ou quantas respostas faltam. */
  headline: string;
  /** Os números por trás da frase. */
  detail: string;
  /** Diferença entre o acerto da conta e o do Brasil nas mesmas questões (−1 a 1); null sem base. */
  diff: number | null;
}

const HEADLINE: Record<Level, string> = { bem: "Você vai bem", media: "Na média de quem fez a prova", reforco: "Precisa de reforço" };

export function read(t: Tally, min: number): Reading {
  if (t.answers === 0) return { level: null, headline: "Sem respostas ainda", detail: `Com ${min} respostas já dá para comparar.`, diff: null };
  const mine = `Você acertou ${t.correct} de ${t.answers}.`;
  if (t.withBrazil < min) {
    const left = min - t.withBrazil;
    return { level: null, headline: left === 1 ? "Falta 1 resposta para comparar" : `Faltam ${left} respostas para comparar`, detail: mine, diff: null };
  }
  const diff = t.correctWithBrazil / t.withBrazil - t.brazilSum / t.withBrazil;
  const level: Level = diff >= PROFILE_RULE.margin ? "bem" : diff <= -PROFILE_RULE.margin ? "reforco" : "media";
  const expected = Math.round(t.brazilSum);
  return {
    level,
    headline: HEADLINE[level],
    detail: `${mine} Nas mesmas questões, quem fez o Enem acertou em média ${expected}.`,
    diff,
  };
}

/**
 * A área mais forte e a que mais pede reforço, entre as que já dá para comparar (precisa de duas).
 * Só chama de forte o que está na média ou acima, e só aponta reforço no que não está indo bem.
 */
export function extremes<T extends { label: string; reading: Reading }>(rows: T[]): { strongest: string | null; weakest: string | null } | null {
  const rated = rows.filter((r) => r.reading.diff !== null).sort((a, b) => b.reading.diff! - a.reading.diff!);
  if (rated.length < 2 || rated[0]!.reading.diff === rated.at(-1)!.reading.diff) return null;
  const top = rated[0]!;
  const bottom = rated.at(-1)!;
  const out = { strongest: top.reading.level !== "reforco" ? top.label : null, weakest: bottom.reading.level !== "bem" ? bottom.label : null };
  return out.strongest || out.weakest ? out : null;
}

export interface DistractorCount {
  code: string;
  label: string;
  definition: string;
  n: number;
}

/** O tipo de alternativa errada em que a conta mais cai; null com menos de 5 erros de tipo identificado. */
export function errorPattern(counts: DistractorCount[], wrongTotal: number): { top: DistractorCount; classified: number; wrongTotal: number; share: number; others: DistractorCount[] } | null {
  const known = counts.filter((c) => c.code !== "nao_classificado" && c.n > 0).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
  const classified = known.reduce((a, c) => a + c.n, 0);
  if (classified < 5 || !known[0]) return null;
  return { top: known[0], classified, wrongTotal, share: known[0].n / classified, others: known.slice(1, 4) };
}
