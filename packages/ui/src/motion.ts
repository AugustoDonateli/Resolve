/**
 * Tokens de movimento (plano §8, "Princípios e tokens").
 * Motion (cotidiano) e GSAP (sequências) leem estes mesmos valores, e ambos
 * respeitam a mesma decisão de movimento reduzido: preferência do sistema OU
 * opção interna "Reduzir movimento".
 */

export type Bezier = readonly [number, number, number, number];

export const ease = {
  press: [0.2, 0, 0.2, 1],
  state: [0.2, 0, 0, 1],
  layout: [0.22, 1, 0.36, 1],
  evidence: [0.22, 1, 0.36, 1],
  stage: [0.76, 0, 0.24, 1],
} as const satisfies Record<string, Bezier>;

/** Durações em milissegundos. */
export const duration = {
  instant: 0,
  press: 120,
  state: 180,
  layout: 260,
  evidenceMin: 400,
  evidence: 520,
  evidenceMax: 650,
  stage: 600,
  stageMax: 700,
  /** Fade permitido mesmo com movimento reduzido. */
  reducedFade: 100,
} as const;

export const cubic = (b: Bezier) => `cubic-bezier(${b.join(",")})`;

/** Converte curva para string GSAP via CustomEase-free: GSAP aceita funções, então devolvemos uma. */
export function bezierFn([x1, y1, x2, y2]: Bezier): (t: number) => number {
  // Resolve x(t)=p por Newton-Raphson + bisseção; devolve y(t).
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - p;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    while (hi - lo > 1e-6) {
      const x = sx(t);
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** Segundos para Motion/GSAP; com movimento reduzido devolve 0 (estado final). */
export function seconds(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms / 1000;
}
