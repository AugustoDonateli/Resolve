/**
 * Conferência da triagem (F4-T05): liga cada decisão à resolução posterior. Medida do plano: proporção das
 * escolhas "agora" resolvidas corretamente dentro do tempo-alvo, mais os resultados observados de "depois"
 * e "chuto". Decisão sem resolução posterior fica fora do denominador ("não observado"); nada é inferido.
 * O tempo-alvo é a configuração de treino do plano (3 min por questão), não um limite imposto.
 */
export type Decision = "agora" | "depois" | "chuto";

export interface ReviewInput {
  position: number;
  decision: Decision | null;
  triageMs: number | null;
  windowClosed: boolean | null;
  /** Resolução posterior: null = ainda não resolvida. */
  resolved: { correct: boolean | null; activeMs: number | null } | null;
}

export interface ReviewRow extends ReviewInput {
  outcome: "acertou" | "errou" | "anulada" | "nao_observado";
  withinTarget: boolean | null;
}

export const TARGET_MS = 3 * 60_000;

export function reviewTriage(items: ReviewInput[]) {
  const rows: ReviewRow[] = items.map((i) => ({
    ...i,
    outcome: !i.resolved
      ? "nao_observado"
      : i.resolved.correct === null
        ? "anulada"
        : i.resolved.correct
          ? "acertou"
          : "errou",
    withinTarget:
      i.resolved?.activeMs == null ? null : i.resolved.activeMs <= TARGET_MS,
  }));
  const by = (d: Decision) => rows.filter((r) => r.decision === d);
  const observed = (rs: ReviewRow[]) =>
    rs.filter((r) => r.outcome === "acertou" || r.outcome === "errou");
  const agora = by("agora");
  const agoraObs = observed(agora);
  return {
    rows,
    agora: {
      decided: agora.length,
      observed: agoraObs.length,
      correctWithinTarget: agoraObs.filter(
        (r) => r.outcome === "acertou" && r.withinTarget === true,
      ).length,
      notObserved: agora.length - agoraObs.length,
    },
    depois: {
      decided: by("depois").length,
      observed: observed(by("depois")).length,
      correct: observed(by("depois")).filter((r) => r.outcome === "acertou")
        .length,
    },
    chuto: {
      decided: by("chuto").length,
      observed: observed(by("chuto")).length,
      correct: observed(by("chuto")).filter((r) => r.outcome === "acertou")
        .length,
    },
  };
}
