import type { StudyQuestion } from "./question-types";

/**
 * Texto compartilhado: questões da sessão com o mesmo texto-base ficam sabendo umas das outras (o texto
 * aparece inteiro na primeira e recolhido nas seguintes, como "texto para as questões 3 e 4").
 */
export function markSharedTexts(
  entries: { itemVersionId: string; question: StudyQuestion }[],
  rows: Map<string, { stimulus_version_id?: string | null }>,
) {
  const groups = new Map<string, number[]>();
  entries.forEach((e, i) => {
    const sid = rows.get(e.itemVersionId)?.stimulus_version_id;
    if (sid) groups.set(sid, [...(groups.get(sid) ?? []), i]);
  });
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const positions = idx.map((i) => i + 1);
    idx.forEach((i, k) => (entries[i]!.question.shared = { positions, first: k === 0 }));
  }
}

/**
 * Monta a lista da sessão mantendo juntas as questões do mesmo texto-base: ao escolher uma questão,
 * as outras do mesmo texto (na ordem dos candidatos) entram logo depois, até `count`.
 */
export function packSharedTexts(candidates: string[], stimulusOf: Map<string, string | null>, count: number): string[] {
  const out: string[] = [];
  const taken = new Set<string>();
  for (const id of candidates) {
    if (out.length >= count) break;
    if (taken.has(id)) continue;
    const sid = stimulusOf.get(id) ?? null;
    const group = sid ? candidates.filter((c) => (stimulusOf.get(c) ?? null) === sid) : [id];
    for (const g of [id, ...group.filter((x) => x !== id)]) {
      if (out.length >= count || taken.has(g)) continue;
      out.push(g);
      taken.add(g);
    }
  }
  return out;
}
