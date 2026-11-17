import type { Lesson } from "./types";

/**
 * Checagem automática de estilo das lições (plano v2, 2A.1 e 2A.4): palavras de efeito, exclamação,
 * emoji, frases e parágrafos longos demais e partes obrigatórias.
 */
export const FORBIDDEN = [
  "mergulh", "jornada", "desvend", "domine de vez", "poderos", "incríve", "incrive", "segredo", "guia definitivo",
  "vamos juntos", "prepare-se", "garante", "nunca mais erre", "fácil demais", "simplesmente", "mágic", "turbin",
];
export const LIMITS = { sentenceWords: 32, paragraphWords: 75 } as const;

const EMOJI = /\p{Extended_Pictographic}/u;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** Frases de um parágrafo (corta em ponto, dois-pontos final de frase, interrogação; ignora números como 0,25 e 1.000). */
export const sentences = (p: string) => p.split(/(?<=[.?;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"(0-9])/u).filter(Boolean);

export interface StyleProblem {
  where: string;
  problem: string;
}

/** Problemas de um texto corrido (um parágrafo). */
export function checkParagraph(text: string, where: string, opts: { allowQuestion?: boolean } = {}): StyleProblem[] {
  const out: StyleProblem[] = [];
  const low = text.toLowerCase();
  for (const f of FORBIDDEN) if (low.includes(f)) out.push({ where, problem: `palavra de efeito: “${f}”` });
  if (text.includes("!")) out.push({ where, problem: "exclamação" });
  if (EMOJI.test(text)) out.push({ where, problem: "emoji" });
  if (!opts.allowQuestion && /^[^.]*\?/.test(text.trim())) out.push({ where, problem: "pergunta retórica na abertura" });
  if (words(text) > LIMITS.paragraphWords) out.push({ where, problem: `parágrafo com ${words(text)} palavras (máximo ${LIMITS.paragraphWords})` });
  for (const s of sentences(text))
    if (words(s) > LIMITS.sentenceWords) out.push({ where, problem: `frase com ${words(s)} palavras: “${s.slice(0, 60)}…”` });
  return out;
}

/** Todos os problemas de uma lição: estilo de cada texto e partes obrigatórias. */
export function checkLesson(l: Lesson): StyleProblem[] {
  const out: StyleProblem[] = [];
  const need = (ok: boolean, problem: string) => !ok && out.push({ where: l.slug, problem });
  need(l.entry.options.length >= 3 && l.entry.options.filter((o) => o.correct).length === 1, "pergunta de entrada com 3 ou mais opções e uma certa");
  need(l.explanation.length >= 3 && l.explanation.length <= 8, "explicação com 3 a 8 parágrafos");
  need(l.worked.steps.length >= 2, "exemplo resolvido com 2 passos ou mais");
  need(l.gapped.gaps.length >= 1 && l.gapped.gaps.length <= 4, "exemplo com 1 a 4 lacunas");
  need(l.practice.qs.length >= 2, "pelo menos 2 questões para resolver sozinho");
  need(l.traps.length >= 1, "pelo menos uma pegadinha");
  need(l.cards.length >= 2, "pelo menos 2 cartões de resumo");
  const used = [l.worked.q, l.gapped.q, ...l.traps.map((t) => t.q)];
  need(!l.practice.qs.some((q) => used.includes(q)), "questão do treino sozinho não pode aparecer resolvida na lição");
  const texts: [string, string, boolean?][] = [
    [l.oneLine, "em uma frase"],
    [l.entry.prompt, "pergunta de entrada", true],
    ...l.entry.options.map((o, i): [string, string] => [o.feedback, `retorno da opção ${i + 1}`]),
    ...l.explanation.map((p, i): [string, string] => [p, `explicação, parágrafo ${i + 1}`]),
    [l.extraExample, "exemplo extra"],
    [l.worked.intro, "exemplo resolvido, abertura"],
    ...l.worked.steps.map((p, i): [string, string] => [p, `exemplo resolvido, passo ${i + 1}`]),
    [l.worked.afterNote, "exemplo resolvido, nota"],
    [l.gapped.intro, "lacunas, abertura"],
    ...l.gapped.gaps.map((g, i): [string, string, boolean] => [g.label, `lacuna ${i + 1}`, true]),
    ...l.gapped.gaps.map((g, i): [string, string] => [g.explain, `lacuna ${i + 1}, explicação`]),
    [l.gapped.conclusion, "lacunas, conclusão"],
    [l.practice.note, "treino, nota"],
    ...l.traps.flatMap((t) => t.text.map((p, i): [string, string] => [p, `pegadinha ${t.q}, parágrafo ${i + 1}`])),
    ...l.cards.flatMap((c, i): [string, string, boolean][] => [
      [c.front, `cartão ${i + 1}, frente`, true],
      [c.back, `cartão ${i + 1}, verso`, true],
    ]),
  ];
  for (const [t, where, q] of texts) out.push(...checkParagraph(t, `${l.slug} · ${where}`, { allowQuestion: q }));
  return out;
}
