/**
 * Rascunho de redação (F5-T05): o aluno escreve num campo só; parágrafos são separados por linha em branco.
 * O banco guarda os parágrafos ({id, text}) e deriva o texto corrido. A cópia no aparelho guarda o que ainda
 * não chegou ao servidor, com a revisão em que se baseou, para recuperar depois de recarregar ou cair a rede.
 */
export interface Paragraph {
  id: string;
  text: string;
}

/** Texto do campo → parágrafos (linhas em branco separam; espaços nas pontas saem; vazios somem). */
export function toParagraphs(text: string): Paragraph[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((t) => t.replace(/^\n+|\n+$/g, "").trimEnd())
    .filter((t) => t.trim().length > 0)
    .slice(0, 60)
    .map((t, i) => ({ id: `p${i + 1}`, text: t }));
}

export function fromParagraphs(ps: { text: string }[]): string {
  return ps.map((p) => p.text).join("\n\n");
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

export interface LocalCopy {
  text: string;
  baseRevision: number;
  savedAt: string;
}

export type Recovery =
  | { kind: "server" }
  | { kind: "local"; text: string }
  | { kind: "conflict"; local: string; server: string };

/**
 * Ao abrir: compara a cópia do aparelho com o servidor.
 * - igual (ou sem cópia): usa o servidor;
 * - cópia diferente feita sobre a revisão atual: recupera a cópia (alterações não enviadas);
 * - cópia diferente feita sobre revisão antiga: outra aba/aparelho gravou depois → conflito, o aluno escolhe.
 */
export function recover(
  serverText: string,
  serverRevision: number,
  local: LocalCopy | null,
): Recovery {
  if (!local || local.text === serverText) return { kind: "server" };
  if (local.baseRevision === serverRevision)
    return { kind: "local", text: local.text };
  return { kind: "conflict", local: local.text, server: serverText };
}
