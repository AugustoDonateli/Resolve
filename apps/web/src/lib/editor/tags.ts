import { z } from "zod";
import { textProblem } from "./payload";

/**
 * Revisão de etiquetas (F2-T13). Mesmo formato que o banco valida em private.tag_review_problems:
 * aprovar exige cada campo aplicável ou uma justificativa de ausência.
 */
const safe = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .superRefine((t, ctx) => {
      const p = textProblem(t);
      if (p) ctx.addIssue({ code: "custom", message: p });
    });
const optionalSafe = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .superRefine((t, ctx) => {
      const p = textProblem(t);
      if (p) ctx.addIssue({ code: "custom", message: p });
    });

export const CHECKLIST = [
  { key: "texto_conferido", label: "Texto conferido contra o PDF" },
  { key: "sinais_e_formulas", label: "Sinais, números e fórmulas conferidos" },
  { key: "ordem_das_alternativas", label: "Ordem e letras das alternativas conferidas" },
  { key: "figuras_sem_corte", label: "Nenhuma figura com informação cortada" },
  { key: "texto_alternativo_sem_resposta", label: "Texto alternativo das figuras não revela a resposta" },
  { key: "gabarito_oficial", label: "Gabarito conferido contra o oficial do Inep" },
  { key: "fonte_registrada", label: "Fonte e caderno registrados" },
] as const;
export type ChecklistKey = (typeof CHECKLIST)[number]["key"];

export const DEPENDENCY = [
  { level: 0, label: "0 · resolve-se só com o que está na questão" },
  { level: 1, label: "1 · conhecimento escolar básico" },
  { level: 2, label: "2 · conteúdo específico da disciplina" },
  { level: 3, label: "3 · conteúdo específico em várias etapas" },
] as const;

const evidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    block_id: z.string().regex(/^[a-z0-9_-]{1,24}$/),
    start_utf16: z.number().int().min(0),
    end_utf16: z.number().int().min(1),
    quote: safe(1, 2000),
    rationale: optionalSafe(2000),
  }),
  z.object({ type: z.literal("figure"), figure_id: z.string().regex(/^[a-z0-9_-]{1,24}$/), rationale: optionalSafe(2000) }),
]);
export type Evidence = z.infer<typeof evidenceSchema>;

const code = z.string().regex(/^[a-z_]{3,40}$/);

export const tagsSchema = z.object({
  skill: z.object({ code: z.string().regex(/^H\d{1,2}$/) }).nullable(),
  secondary_skill: z.object({ code: z.string().regex(/^H\d{1,2}$/) }).nullable(),
  content_dependency: z.number().int().min(0).max(3).nullable(),
  subjects: z.object({ ids: z.array(z.string().uuid()).max(10), absent_reason: optionalSafe(500) }),
  evidence: z.array(evidenceSchema).max(20),
  evidence_absent_reason: optionalSafe(1000),
  distractors: z.array(z.object({ letter: z.enum(["A", "B", "C", "D", "E"]), type: code.or(z.literal("")), secondary_type: code.nullable(), rationale: optionalSafe(2000) })).max(5),
  explanation: z.object({ steps: z.array(z.object({ id: z.string().regex(/^[a-z0-9_-]{1,24}$/), text: optionalSafe(4000) })).max(20), absent_reason: optionalSafe(1000) }),
});
export type Tags = z.infer<typeof tagsSchema>;

export const reviewSchema = z.object({
  proposalId: z.string().uuid(),
  proposalRevision: z.number().int().min(0),
  decision: z.enum(["aprovar", "devolver", "rejeitar"]),
  tags: tagsSchema,
  checklist: z.record(z.string(), z.boolean()),
  notes: optionalSafe(4000),
  suggestionId: z.string().uuid().nullable(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

/** Remove o que está vazio antes de enviar (passo sem texto, justificativa vazia etc.). */
export function cleanTags(t: Tags): Tags {
  return {
    ...t,
    explanation: { steps: t.explanation.steps.filter((s) => s.text.trim()), absent_reason: t.explanation.absent_reason },
  };
}

/**
 * Localiza um trecho colado dentro do texto do bloco. Offsets em unidades UTF-16 (as do JavaScript
 * e as do banco). Trecho repetido no bloco é ambíguo: pede mais contexto em vez de adivinhar.
 */
export function locateQuote(blockText: string, quote: string): { start: number; end: number } | { error: string } {
  const q = quote.trim();
  if (!q) return { error: "Cole o trecho exato do texto." };
  const first = blockText.indexOf(q);
  if (first < 0) return { error: "O trecho não aparece literalmente neste bloco." };
  if (blockText.indexOf(q, first + 1) >= 0) return { error: "O trecho aparece mais de uma vez no bloco: inclua mais palavras." };
  return { start: first, end: first + q.length };
}
