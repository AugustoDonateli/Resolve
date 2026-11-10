/**
 * Forma única de uma questão para exibição (F1-T05, F3-T02): vale para a proposta em revisão
 * (prévia do editor) e para a versão publicada (`study_items`). Nenhum gabarito entra aqui.
 */

export type QuestionBlockType =
  | "paragraph"
  | "heading"
  | "source"
  | "image"
  | "table"
  | "formula";

export interface QuestionBlock {
  id: string;
  type: QuestionBlockType;
  text?: string;
  /** Figura: link assinado e texto alternativo (null = ainda não escrito). */
  figure?: { url: string | null; alt: string | null };
}

export interface QuestionAlternative {
  key: string;
  letter: "A" | "B" | "C" | "D" | "E";
  blocks: QuestionBlock[];
}

export interface StudyQuestion {
  area: "LC" | "CH" | "CN" | "MT";
  origin: string;
  stimulus: QuestionBlock[];
  command: QuestionBlock[];
  alternatives: QuestionAlternative[];
}

export const AREA_LABEL: Record<StudyQuestion["area"], string> = {
  LC: "Linguagens",
  CH: "Ciências Humanas",
  CN: "Ciências da Natureza",
  MT: "Matemática",
};

const LETTERS = ["A", "B", "C", "D", "E"] as const;

interface RawBlock {
  id: string;
  type: string;
  text?: string;
  asset_ref?: string;
  asset_id?: string;
}

/** Converte blocos crus; `figureFor` resolve a figura de um bloco de imagem. */
export function toBlocks(
  raw: RawBlock[] | null | undefined,
  figureFor: (b: RawBlock) => QuestionBlock["figure"],
): QuestionBlock[] {
  return (raw ?? [])
    .filter((b) =>
      ["paragraph", "heading", "source", "image", "table", "formula"].includes(
        b.type,
      ),
    )
    .map((b) =>
      b.type === "image"
        ? {
            id: b.id,
            type: "image",
            figure: figureFor(b) ?? { url: null, alt: null },
          }
        : { id: b.id, type: b.type as QuestionBlockType, text: b.text ?? "" },
    );
}

interface ProposalLike {
  area: StudyQuestion["area"];
  number: number;
  source: { day: number; booklet: number };
  stimulus_blocks: RawBlock[] | null;
  command_blocks: RawBlock[];
  alternatives: Record<string, RawBlock[]>;
  figures: { id: string; alt_text?: string }[];
}

/** Proposta em revisão → questão (prévia do editor). `figureUrls` vem de links assinados por figura. */
export function fromProposal(
  p: ProposalLike,
  figureUrls: Record<string, string>,
): StudyQuestion {
  const figs = new Map(p.figures.map((f) => [f.id, f]));
  const figureFor = (b: RawBlock) => {
    const f = b.asset_ref ? figs.get(b.asset_ref) : undefined;
    return {
      url: (b.asset_ref && figureUrls[b.asset_ref]) || null,
      alt: f?.alt_text?.trim() || null,
    };
  };
  return {
    area: p.area,
    origin: `Enem · Dia ${p.source.day} · Caderno ${p.source.booklet} · Questão ${p.number}`,
    stimulus: toBlocks(p.stimulus_blocks, figureFor),
    command: toBlocks(p.command_blocks, figureFor),
    alternatives: LETTERS.map((l) => ({
      key: l,
      letter: l,
      blocks: toBlocks(p.alternatives[l], figureFor),
    })),
  };
}

export interface StudyItemRow {
  item_version_id: string;
  area: StudyQuestion["area"];
  stimulus_blocks: RawBlock[] | null;
  command_blocks: RawBlock[];
  alternatives: { key: string; content_blocks: RawBlock[] }[];
  appearances:
    | { booklet: number; day: number; color: string; position: number }[]
    | null;
}

/** Versão publicada → questão. `assets` mapeia asset_id → link assinado e texto alternativo. */
export function fromStudyItem(
  row: StudyItemRow,
  assets: Record<string, { url: string | null; alt: string | null }>,
): StudyQuestion {
  const figureFor = (b: RawBlock) =>
    b.asset_id ? assets[b.asset_id] : undefined;
  const first = row.appearances?.[0];
  const sorted = [...row.alternatives].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  return {
    area: row.area,
    origin: first
      ? `Enem · Dia ${first.day} · Caderno ${first.booklet} (${first.color}) · Questão ${first.position}`
      : "Enem",
    stimulus: toBlocks(row.stimulus_blocks, figureFor),
    command: toBlocks(row.command_blocks, figureFor),
    alternatives: sorted.map((a, i) => ({
      key: a.key,
      letter: LETTERS[i]!,
      blocks: toBlocks(a.content_blocks, figureFor),
    })),
  };
}

/** Figuras sem texto alternativo: aparecem como pendência na prévia do editor. */
export function missingAlt(q: StudyQuestion): number {
  const all = [
    ...q.stimulus,
    ...q.command,
    ...q.alternatives.flatMap((a) => a.blocks),
  ];
  return all.filter((b) => b.type === "image" && !b.figure?.alt).length;
}
