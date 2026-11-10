/**
 * Treino por peças (F5-T07): quatro modos isolados. Cada peça é uma redação própria (essays.training_piece),
 * com orientação curta e sem nota total — o retorno de uma peça (F5-T15) fala só da peça.
 * A proposta de intervenção segue os cinco elementos da competência 5 da matriz do Inep.
 */
export type Piece =
  | "introducao"
  | "desenvolvimento"
  | "conclusao"
  | "intervencao";

export const PIECES: {
  code: Piece;
  label: string;
  guide: string[];
  minutes?: number;
}[] = [
  {
    code: "introducao",
    label: "Introdução",
    guide: [
      "Apresente o tema com suas palavras.",
      "Deixe clara a sua tese: o ponto de vista que o texto vai defender.",
    ],
  },
  {
    code: "desenvolvimento",
    label: "Desenvolvimento",
    guide: [
      "Um parágrafo que defende um argumento da tese.",
      "Use um repertório legítimo e explique como ele sustenta o argumento.",
    ],
  },
  {
    code: "conclusao",
    label: "Conclusão",
    guide: [
      "Retome a tese sem copiar a introdução.",
      "Feche o raciocínio e encaminhe a proposta de intervenção.",
    ],
  },
  {
    code: "intervencao",
    label: "Proposta de intervenção",
    minutes: 10,
    guide: [
      "Escreva só a proposta, como no último parágrafo da redação.",
      "Inclua os cinco elementos: agente (quem), ação (o quê), meio (como), finalidade (para quê) e detalhamento.",
    ],
  },
];

export const pieceOf = (code: string | null | undefined) =>
  PIECES.find((p) => p.code === code) ?? null;
