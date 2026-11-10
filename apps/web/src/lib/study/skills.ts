/**
 * Medidas dos treinos de habilidade (plano: "comando registra acerto e correspondência da evidência
 * separadamente; distrator registra classificação diante das etiquetas revisadas").
 *
 * Regra da plataforma `evidencia-v1`: o trecho marcado corresponde quando cobre pelo menos metade de
 * algum trecho de evidência editorial, ou quando pelo menos metade do que foi marcado está dentro de um
 * trecho editorial. É uma regra de treino, não uma medida validada de compreensão.
 */

export const EVIDENCE_RULE = "evidencia-v1";

export interface Range {
  block_id: string;
  start_utf16: number;
  end_utf16: number;
  quote?: string;
}

export interface EvidenceResult {
  matched: boolean;
  /** Maior fração de um trecho editorial coberta pelo que foi marcado. */
  bestCoverage: number;
  /** Fração do que foi marcado que cai dentro da evidência editorial. */
  precision: number;
}

const overlap = (a: Range, b: Range) =>
  a.block_id === b.block_id ? Math.max(0, Math.min(a.end_utf16, b.end_utf16) - Math.max(a.start_utf16, b.start_utf16)) : 0;

export function compareEvidence(mine: Range[], editorial: Range[]): EvidenceResult | null {
  if (!editorial.length || !mine.length) return null;
  const bestCoverage = Math.max(
    ...editorial.map((e) => mine.reduce((s, m) => s + overlap(m, e), 0) / (e.end_utf16 - e.start_utf16)),
  );
  const markedLen = mine.reduce((s, m) => s + (m.end_utf16 - m.start_utf16), 0);
  const inside = mine.reduce((s, m) => s + Math.min(m.end_utf16 - m.start_utf16, editorial.reduce((t, e) => t + overlap(m, e), 0)), 0);
  const precision = markedLen ? inside / markedLen : 0;
  return { matched: bestCoverage >= 0.5 || precision >= 0.5, bestCoverage, precision };
}

/** Junta um trecho novo aos já marcados: sobreposição no mesmo bloco vira um trecho só. Máximo de 3. */
export function addRange(ranges: Range[], next: Range, max = 3): Range[] {
  if (next.end_utf16 <= next.start_utf16) return ranges;
  let merged = { ...next };
  const rest: Range[] = [];
  for (const r of ranges) {
    if (r.block_id === merged.block_id && r.start_utf16 <= merged.end_utf16 && merged.start_utf16 <= r.end_utf16) {
      merged = { block_id: r.block_id, start_utf16: Math.min(r.start_utf16, merged.start_utf16), end_utf16: Math.max(r.end_utf16, merged.end_utf16) };
    } else rest.push(r);
  }
  return [...rest, merged].slice(-max);
}

export interface DistractorChoice {
  key: string;
  type: string;
  justification?: string;
}

export interface DistractorRow {
  key: string;
  mine: string;
  editorial: { type: string; label: string; rationale: string } | null;
  agrees: boolean | null;
}

/** Compara a classificação do aluno com o tipo primário revisado; sem etiqueta, a concordância fica nula. */
export function compareDistractors(
  choices: DistractorChoice[],
  editorial: { key: string; type: string; label: string; rationale: string }[] | null,
): DistractorRow[] {
  return choices.map((c) => {
    const e = editorial?.find((x) => x.key === c.key) ?? null;
    return { key: c.key, mine: c.type, editorial: e, agrees: e ? c.type === e.type : null };
  });
}
