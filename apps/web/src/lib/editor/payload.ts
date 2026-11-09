import { z } from "zod";

/**
 * Proposta de questão (contrato item-proposal/v1, data/contracts/item-proposal.v1.schema.json),
 * na parte que o editor corrige: texto-base, comando, alternativas e figuras. A identidade
 * (origem, número, língua, área) não muda; o banco recusa revisão que a altere.
 */

// Mesmas regras de private.text_is_safe e de tools/ingest/contract.py.
const HTML_TAG = /<[a-zA-Z][a-zA-Z0-9-]*(?:[\s/][^<>]*)?>|<\/[a-zA-Z][^<>]*>|<[!?]/;
const DANGEROUS = /(javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]{3,}\s*=|&#x?0*3c;?|&lt;\s*script)/i;
// Caracteres de inversão de direção e de controle (exceto quebra de linha e tabulação).
const BIDI = /[‪-‮⁦-⁩‎‏]/;
const CONTROL = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function textProblem(t: string): string | null {
  if (HTML_TAG.test(t)) return "Texto com marcação HTML não é aceito.";
  if (DANGEROUS.test(t)) return "Texto com padrão executável não é aceito.";
  if (BIDI.test(t)) return "Texto com caractere de inversão de direção não é aceito.";
  if (CONTROL.test(t)) return "Texto com caractere de controle não é aceito.";
  return null;
}

const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .superRefine((t, ctx) => {
      const p = textProblem(t);
      if (p) ctx.addIssue({ code: "custom", message: p });
    });

const blockId = z.string().regex(/^[a-z0-9_-]{1,24}$/);

export const blockSchema = z
  .object({
    id: blockId,
    type: z.enum(["paragraph", "heading", "source", "image", "table", "formula"]),
    text: safeText(20000).optional(),
    asset_ref: blockId.optional(),
  })
  .strict();
export type Block = z.infer<typeof blockSchema>;

export const figureSchema = z
  .object({
    id: blockId,
    role: z.string().regex(/^(texto-base\/comando|alternativa [A-E])$/),
    kind: z.enum(["imagem", "figura", "tabela"]).optional(),
    page: z.number().int().min(1),
    bbox_pt: z.tuple([z.number(), z.number(), z.number(), z.number()]).refine(([x0, t, x1, b]) => x0 < x1 && t < b, "Caixa inválida: o canto final precisa ficar à direita e abaixo do inicial."),
    png_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    alt_text: safeText(2000).optional(),
    recrop_pending: z.boolean().optional(),
  })
  .strict();
export type Figure = z.infer<typeof figureSchema>;

const LETTERS = ["A", "B", "C", "D", "E"] as const;
export type Letter = (typeof LETTERS)[number];

const altBlocks = z.array(blockSchema).min(1).max(6);

/** O que o formulário envia: só a parte editável. */
export const editSchema = z.object({
  proposalId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  note: z
    .string()
    .trim()
    .min(3, "Descreva a correção (mínimo de 3 caracteres).")
    .max(1000)
    .superRefine((t, ctx) => {
      const p = textProblem(t);
      if (p) ctx.addIssue({ code: "custom", message: p });
    }),
  stimulus_blocks: z.array(blockSchema).max(80),
  command_blocks: z.array(blockSchema).min(1).max(10),
  alternatives: z.object({ A: altBlocks, B: altBlocks, C: altBlocks, D: altBlocks, E: altBlocks }),
  figures: z.array(figureSchema).max(30),
});
export type EditInput = z.infer<typeof editSchema>;

export interface ProposalPayload {
  contract: "item-proposal/v1";
  source: { booklet_file: string; booklet_sha256: string; day: number; booklet: number; pages: number[]; bbox_by_page: Record<string, [number, number, number, number]> };
  number: number;
  foreign_language: "ingles" | "espanhol" | null;
  area: "LC" | "CH" | "CN" | "MT";
  stimulus_blocks: Block[];
  command_blocks: Block[];
  alternatives: Record<Letter, Block[]>;
  figures: Figure[];
  producer: Record<string, unknown>;
  doubts: string[];
}

/** Junta a correção ao conteúdo atual sem tocar na identidade da questão. */
export function applyEdit(current: ProposalPayload, edit: EditInput): ProposalPayload {
  const before = new Map(current.figures.map((f) => [f.id, f]));
  const figures = edit.figures.map((f) => {
    const old = before.get(f.id);
    const moved = old && old.bbox_pt.some((v, i) => v !== f.bbox_pt[i]);
    // A imagem recortada corresponde à caixa antiga: novo recorte na publicação.
    return moved ? { ...f, recrop_pending: true } : f;
  });
  return {
    ...current,
    stimulus_blocks: edit.stimulus_blocks,
    command_blocks: edit.command_blocks,
    alternatives: edit.alternatives,
    figures,
  };
}

/** JSON com chaves ordenadas: o jsonb do banco devolve as chaves em outra ordem que o formulário. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Lista legível do que mudou entre duas versões (vai para o histórico). */
export function changedFields(a: ProposalPayload, b: ProposalPayload): string[] {
  const out: string[] = [];
  const same = (x: unknown, y: unknown) => canonical(x) === canonical(y);
  const ids = new Set([...a.stimulus_blocks.map((x) => x.id), ...b.stimulus_blocks.map((x) => x.id)]);
  for (const id of ids) {
    const x = a.stimulus_blocks.find((s) => s.id === id);
    const y = b.stimulus_blocks.find((s) => s.id === id);
    if (!x) out.push(`texto-base: bloco ${id} incluído`);
    else if (!y) out.push(`texto-base: bloco ${id} removido`);
    else if (!same(x, y)) out.push(`texto-base: bloco ${id}`);
  }
  if (!same(a.command_blocks, b.command_blocks)) out.push("comando");
  for (const k of LETTERS) if (!same(a.alternatives[k], b.alternatives[k])) out.push(`alternativa ${k}`);
  for (const f of b.figures) {
    const old = a.figures.find((x) => x.id === f.id);
    if (!old) continue;
    if (!same(old.bbox_pt, f.bbox_pt)) out.push(`figura ${f.id}: caixa`);
    if ((old.alt_text ?? "") !== (f.alt_text ?? "")) out.push(`figura ${f.id}: texto alternativo`);
  }
  return out;
}

export const LETTER_LIST = LETTERS;
