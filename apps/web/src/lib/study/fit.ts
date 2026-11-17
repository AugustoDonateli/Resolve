/**
 * Treino na medida (`medida-v1`, regra da plataforma): entre as questões que a conta ainda não respondeu,
 * escolhe as de dificuldade mais próxima de um ponto logo acima do nível estimado dela.
 * `b` é a dificuldade oficial da questão (parâmetro do Inep) e `theta` o nível estimado, na mesma escala.
 */
export const FIT_RULE = { id: "medida-v1", step: 0.3 } as const;

export function pickFitted(items: { id: string; b: number }[], theta: number, count: number): string[] {
  const target = theta + FIT_RULE.step;
  return [...items]
    .sort((x, y) => Math.abs(x.b - target) - Math.abs(y.b - target) || x.id.localeCompare(y.id))
    .slice(0, count)
    .map((x) => x.id);
}
