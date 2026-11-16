/** Faixa de um texto (posições UTF-16, as mesmas de uma string do JavaScript). */
export interface MarkRange {
  start: number;
  end: number;
}

/**
 * Divide o trecho [from, to) de um texto em pedaços, dizendo quais caem dentro de alguma faixa.
 * Faixas sobrepostas se fundem; o que passa do trecho é cortado. Sem faixa no trecho, devolve um pedaço só.
 */
export function splitMarks(text: string, ranges: MarkRange[], from = 0, to = text.length): { text: string; marked: boolean }[] {
  const cuts = ranges
    .map((r) => ({ start: Math.max(from, r.start), end: Math.min(to, r.end) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: MarkRange[] = [];
  for (const r of cuts) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  const out: { text: string; marked: boolean }[] = [];
  let at = from;
  for (const r of merged) {
    if (r.start > at) out.push({ text: text.slice(at, r.start), marked: false });
    out.push({ text: text.slice(r.start, r.end), marked: true });
    at = r.end;
  }
  if (at < to || out.length === 0) out.push({ text: text.slice(at, to), marked: false });
  return out;
}
