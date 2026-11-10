/**
 * DADOS DEMONSTRATIVOS — parâmetros FICTÍCIOS para mostrar como a régua e os cenários funcionam.
 * Não são parâmetros do Enem nem de nenhuma prova; a escala é θ (a do modelo), sem conversão para nota.
 */
import type { ModelConfig } from "@/lib/tri/engine";

export const demoConfig: ModelConfig = {
  D: 1,
  prior: { kind: "normal", mean: 0, sd: 1 },
  quadrature: { from: -6, to: 6, points: 121 },
  transform: null,
  intervalZ: 1.645,
};

export const demoData = [
  { itemId: "d1", label: "fácil 1", a: 1.3, b: -1.6, c: 0.2, correct: true },
  { itemId: "d2", label: "fácil 2", a: 1.1, b: -1.2, c: 0.2, correct: false },
  { itemId: "d3", label: "média 1", a: 1.5, b: -0.3, c: 0.18, correct: true },
  { itemId: "d4", label: "média 2", a: 0.9, b: 0.1, c: 0.22, correct: true },
  { itemId: "d5", label: "média 3", a: 1.2, b: 0.4, c: 0.2, correct: false },
  { itemId: "d6", label: "difícil 1", a: 1.8, b: 1.2, c: 0.15, correct: false },
  { itemId: "d7", label: "difícil 2", a: 1.0, b: 1.6, c: 0.25, correct: true },
  { itemId: "d8", label: "difícil 3", a: 1.4, b: 2.0, c: 0.2, correct: false },
];
