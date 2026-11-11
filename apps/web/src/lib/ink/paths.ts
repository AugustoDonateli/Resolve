/**
 * Traços de caneta: caminhos SVG com irregularidade de mão, sempre iguais para a mesma semente
 * (o desenho não muda entre servidor e navegador, nem a cada renderização).
 * Coordenadas num quadro de 44 × 44 com centro em (22, 22).
 */

type Pt = [number, number];

/** Gerador determinístico simples (LCG). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function seedOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Curva suave por todos os pontos (Catmull-Rom convertida em Bézier cúbica). */
export function smooth(p: Pt[]) {
  let d = `M${p[0]![0].toFixed(1)},${p[0]![1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!, b = p[i]!, c = p[i + 1]!, e = p[i + 2] ?? c;
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}

/** Círculo feito à mão: raio levemente irregular e ponta que passa do começo. */
export function ring(r: number, seed: number, turns = 1.1) {
  const R = rng(seed), n = 16, a0 = R() * 6.28, pts: Pt[] = [];
  for (let i = 0; i <= n * turns; i++) {
    const a = a0 + (i / n) * 6.283, rr = r + (R() - 0.5) * 1.4 + i * 0.045;
    pts.push([22 + Math.cos(a) * rr, 22 + Math.sin(a) * rr * 0.97]);
  }
  return smooth(pts);
}

/** Rabisco em zigue-zague que cobre um círculo de raio r (a bolinha preenchida à caneta). */
export function scribble(r: number, seed: number) {
  const R = rng(seed), ang = -0.62 + (R() - 0.5) * 0.3, pts: Pt[] = [];
  let side = 1;
  for (let y = -r; y <= r; y += 2.5) {
    const w = Math.sqrt(Math.max(0, r * r - y * y)) + 1.2, x = side * (w + (R() - 0.5) * 2.2), yy = y + (R() - 0.5);
    side = -side;
    pts.push([22 + x * Math.cos(ang) - yy * Math.sin(ang), 22 + x * Math.sin(ang) + yy * Math.cos(ang)]);
  }
  return smooth(pts);
}

/** Visto de corretor e xis, no mesmo quadro de 44 × 44. */
export const CHECK = "M9 24c4 3 7 7 9 12C22 22 28 13 37 6";
export const CROSS = "M11 11 33 33M33 11 11 33";
/** Traço diagonal de quem descarta uma alternativa. */
export const SLASH = "M9 35C17 27 27 17 36 8";
