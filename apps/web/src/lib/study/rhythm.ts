/**
 * Blocos de ritmo (F4-T06). Configurações do plano (§ "Durações dos treinos"): alvo inicial de 3 min por
 * questão e aviso discreto após 4 min, ajustáveis; blocos de 45, 90 e 180 min e treino curto; a duração
 * integral da prova fica para o Dia D. Medida: média e mediana de tempo, acerto e conclusão do bloco.
 */
export const BLOCKS = [
  { minutes: 15, label: "Treino curto (15 min)" },
  { minutes: 45, label: "Bloco de 45 min" },
  { minutes: 90, label: "Bloco de 90 min" },
  { minutes: 180, label: "Bloco de 180 min" },
] as const;

export interface RhythmConfig {
  targetMin: number;
  warnMin: number;
}
export const DEFAULT_CONFIG: RhythmConfig = { targetMin: 3, warnMin: 4 };

/** Lê a configuração salva; valores fora do razoável voltam ao padrão. Aviso nunca antes do alvo. */
export function parseConfig(raw: string | null): RhythmConfig {
  try {
    const c = raw ? (JSON.parse(raw) as Partial<RhythmConfig>) : {};
    const target =
      Number.isFinite(c.targetMin) && c.targetMin! >= 1 && c.targetMin! <= 15
        ? Math.round(c.targetMin!)
        : DEFAULT_CONFIG.targetMin;
    const warn =
      Number.isFinite(c.warnMin) && c.warnMin! >= target && c.warnMin! <= 20
        ? Math.round(c.warnMin!)
        : Math.max(target + 1, DEFAULT_CONFIG.warnMin);
    return { targetMin: target, warnMin: warn };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Quantas questões cabem no bloco pelo alvo (limitado ao que existe publicado). */
export const questionsFor = (
  minutes: number,
  cfg: RhythmConfig,
  available: number,
) => Math.max(1, Math.min(available, Math.floor(minutes / cfg.targetMin)));

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function rhythmStats(
  items: { answered: boolean; correct: boolean | null; ms: number }[],
) {
  const answered = items.filter((i) => i.answered);
  const times = answered.map((i) => i.ms);
  const graded = answered.filter((i) => i.correct !== null);
  return {
    total: items.length,
    answered: answered.length,
    correct: graded.filter((i) => i.correct).length,
    graded: graded.length,
    meanMs: times.length
      ? times.reduce((a, b) => a + b, 0) / times.length
      : null,
    medianMs: median(times),
    completed: items.length > 0 && answered.length === items.length,
  };
}
