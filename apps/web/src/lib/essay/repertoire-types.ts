/** Tipos do repertório pessoal (usados no servidor e na tela). */
export const KINDS = {
  citacao: "Citação",
  dado: "Dado",
  obra: "Obra",
  fato_historico: "Fato histórico",
  conceito: "Conceito",
  lei: "Lei ou norma",
} as const;
export type Kind = keyof typeof KINDS;

export interface RepertoireItem {
  id: string;
  kind: Kind;
  content: string;
  origin: string | null;
  source: string;
  axes: string[];
  use_note: string | null;
  archived_at: string | null;
  created_at: string;
}

