/**
 * Folha simulada (F5-T06): perfil fixo da plataforma, não do Inep. As quebras de linha são calculadas
 * aqui, com uma regra só (não pelo navegador), então o mesmo texto dá a mesma contagem em PC e celular.
 * A contagem descreve a simulação digital; não prevê quantas linhas a caligrafia de cada um ocupa.
 */
import { toParagraphs } from "./draft";

export const SHEET_PROFILE = {
  version: "folha-v1",
  columns: 64,
  lineLimit: 30,
  indent: 2,
  wrapping: "quebra-por-palavra-v1",
} as const;

export interface SheetLine {
  text: string;
  /** Primeira linha de parágrafo (com recuo). */
  first: boolean;
}

/**
 * Quebra por palavra: cada parágrafo começa numa linha nova, com recuo; quebras simples dentro do
 * parágrafo viram espaço; palavra maior que a linha é partida no limite.
 */
export function wrapLines(
  text: string,
  columns: number = SHEET_PROFILE.columns,
  indent: number = SHEET_PROFILE.indent,
): SheetLine[] {
  const out: SheetLine[] = [];
  for (const p of toParagraphs(text)) {
    const words = p.text.split(/\s+/).filter(Boolean);
    let line = " ".repeat(indent);
    let first = true;
    let empty = true;
    const push = () => {
      out.push({ text: line, first });
      first = false;
      line = "";
      empty = true;
    };
    for (let w of words) {
      while (w.length > 0) {
        const room = columns - line.length - (empty ? 0 : 1);
        if (w.length <= room) {
          line += (empty ? "" : " ") + w;
          empty = false;
          w = "";
        } else if (!empty) {
          push();
        } else {
          line += w.slice(0, room);
          w = w.slice(room);
          empty = false;
          push();
        }
      }
    }
    if (!empty || first) push();
  }
  return out;
}

export function sheetSummary(text: string): {
  lines: number;
  over: number;
  limit: number;
} {
  const lines = wrapLines(text).length;
  return {
    lines,
    over: Math.max(0, lines - SHEET_PROFILE.lineLimit),
    limit: SHEET_PROFILE.lineLimit,
  };
}
