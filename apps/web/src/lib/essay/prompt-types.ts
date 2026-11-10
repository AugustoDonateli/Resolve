/** Tipos de tema de redação, compartilhados entre servidor e cliente. */
/** Bloco de texto motivador, no formato dos blocos do banco (private.blocks_are_safe). */
export interface PromptBlock {
  id: string;
  type: "paragraph" | "heading" | "image" | "source" | "table" | "formula";
  text?: string;
  asset_ref?: string;
}

export interface MotivatingText {
  id: string;
  position: number;
  blocks: PromptBlock[];
  citation: string | null;
  page_or_locator: string;
  rights_status: "verificado" | "pendente" | "restrito";
  verified_at: string | null;
}

export interface PromptSummary {
  id: string;
  title: string;
  origin: "oficial" | "editorial";
  edition: string | null;
  status: "draft" | "published" | "retired";
  published_at: string | null;
}

export interface PromptDetail extends PromptSummary {
  instruction: string;
  source_locator: string | null;
  texts: MotivatingText[];
  /** URL assinada de cada figura (chave: asset_ref). Ausente = arquivo indisponível. */
  figureUrls: Record<string, string>;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
