/**
 * Motor de TRI (modelo logístico de 3 parâmetros) com estimativa EAP.
 *
 * Nada aqui tem constante embutida de escala ou de modelo: a constante D, a priori, a grade de
 * integração e a transformação para a escala de notas vêm de uma configuração registrada (versão do
 * modelo no banco, ligada a um conjunto de parâmetros com fonte). Sem configuração, não há cálculo.
 *
 * Item sem parâmetro válido não vira zero: fica fora do cálculo e é contado como excluído.
 * A faixa devolvida é a faixa posterior do modelo (média ± z·desvio da posteriori), não uma faixa
 * calibrada; quem exibe precisa rotulá-la assim.
 */

export interface ItemParameters {
  a: number;
  b: number;
  c: number;
}

export interface ModelConfig {
  /** Constante de escala do logístico (registrada com o conjunto de parâmetros; ex.: 1 ou 1,7). */
  D: number;
  prior: { kind: "normal"; mean: number; sd: number };
  quadrature: { from: number; to: number; points: number };
  /** Nota = intercept + slope × θ (registrada com fonte); null = só θ. */
  transform: { slope: number; intercept: number } | null;
  /** Quantil da normal para a faixa posterior (ex.: 1,645 para 90%). */
  intervalZ: number;
}

export interface Response {
  itemId: string;
  correct: boolean;
}

export interface Estimate {
  theta: number;
  thetaSd: number;
  /** Na escala de notas quando há transformação; senão, igual a θ. */
  score: number;
  lower: number;
  upper: number;
  nUsed: number;
  excluded: string[];
}

export function validateConfig(cfg: ModelConfig): string | null {
  if (!(cfg.D > 0)) return "D precisa ser positivo";
  if (cfg.prior.kind !== "normal" || !(cfg.prior.sd > 0)) return "priori normal com desvio positivo";
  const q = cfg.quadrature;
  if (!(q.to > q.from) || !Number.isInteger(q.points) || q.points < 11) return "grade de integração inválida";
  if (cfg.transform && !(cfg.transform.slope > 0)) return "transformação precisa de inclinação positiva";
  if (!(cfg.intervalZ > 0)) return "quantil da faixa inválido";
  return null;
}

export function validParameters(p: Partial<ItemParameters> | null | undefined): p is ItemParameters {
  return (
    !!p &&
    Number.isFinite(p.a) &&
    Number.isFinite(p.b) &&
    Number.isFinite(p.c) &&
    (p.a as number) > 0 &&
    (p.c as number) >= 0 &&
    (p.c as number) < 1
  );
}

/** P(acerto | θ) no 3PL. */
export function probability(theta: number, p: ItemParameters, D: number): number {
  return p.c + (1 - p.c) / (1 + Math.exp(-D * p.a * (theta - p.b)));
}

function grid(cfg: ModelConfig): number[] {
  const { from, to, points } = cfg.quadrature;
  const step = (to - from) / (points - 1);
  return Array.from({ length: points }, (_, i) => from + i * step);
}

/**
 * EAP: média e desvio da posteriori de θ dado o vetor de respostas, por integração numérica
 * (regra do trapézio na grade registrada; log-verossimilhança para evitar subfluxo).
 */
export function eap(responses: Response[], params: Map<string, ItemParameters | null | undefined>, cfg: ModelConfig): Estimate {
  const problem = validateConfig(cfg);
  if (problem) throw new Error(`configuração do modelo: ${problem}`);
  const used: { p: ItemParameters; correct: boolean }[] = [];
  const excluded: string[] = [];
  const seen = new Set<string>();
  for (const r of responses) {
    if (seen.has(r.itemId)) continue; // um item conta uma vez (a primeira resposta recebida)
    seen.add(r.itemId);
    const p = params.get(r.itemId);
    if (validParameters(p)) used.push({ p, correct: r.correct });
    else excluded.push(r.itemId);
  }
  const xs = grid(cfg);
  const { mean: m, sd: s } = cfg.prior;
  const logPost = xs.map((t) => {
    let l = -0.5 * ((t - m) / s) ** 2;
    for (const u of used) {
      const pr = probability(t, u.p, cfg.D);
      l += Math.log(u.correct ? pr : 1 - pr);
    }
    return l;
  });
  const max = Math.max(...logPost);
  const w = logPost.map((l) => Math.exp(l - max));
  const h = xs[1]! - xs[0]!;
  const trap = (f: (i: number) => number) => {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) sum += (i === 0 || i === xs.length - 1 ? 0.5 : 1) * f(i);
    return sum * h;
  };
  const z = trap((i) => w[i]!);
  const theta = trap((i) => xs[i]! * w[i]!) / z;
  const variance = trap((i) => (xs[i]! - theta) ** 2 * w[i]!) / z;
  const thetaSd = Math.sqrt(variance);
  const toScore = (t: number) => (cfg.transform ? cfg.transform.intercept + cfg.transform.slope * t : t);
  return {
    theta,
    thetaSd,
    score: toScore(theta),
    lower: toScore(theta - cfg.intervalZ * thetaSd),
    upper: toScore(theta + cfg.intervalZ * thetaSd),
    nUsed: used.length,
    excluded,
  };
}

export interface Scenario {
  label: string;
  /** Itens cuja resposta muda no cenário (true = passa a acerto). */
  changes: { itemId: string; correct: boolean }[];
}

/**
 * Cenário: aplica as mudanças ao vetor de respostas e recalcula a estimativa do conjunto inteiro.
 * O delta é a diferença em relação à base; deltas de cenários diferentes não são parcelas somáveis.
 */
export function scenario(
  responses: Response[],
  params: Map<string, ItemParameters | null | undefined>,
  cfg: ModelConfig,
  sc: Scenario,
): { estimate: Estimate; delta: number } {
  const base = eap(responses, params, cfg);
  const change = new Map(sc.changes.map((c) => [c.itemId, c.correct]));
  const modified = responses.map((r) => (change.has(r.itemId) ? { ...r, correct: change.get(r.itemId)! } : r));
  const estimate = eap(modified, params, cfg);
  return { estimate, delta: estimate.score - base.score };
}
