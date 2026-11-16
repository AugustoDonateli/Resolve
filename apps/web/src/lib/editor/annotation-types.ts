import { z } from "zod";
import type { MarkRange } from "@/lib/study/marks";
import type { QuestionBlock, StudyQuestion } from "@/lib/study/question-types";

/** Conferência das anotações (sessão 3 do plano v2): tipos, validação e contas puras, sem acesso a dados. */

export const AREAS = ["MT", "CN", "CH", "LC"] as const;
export type AreaCode = (typeof AREAS)[number];
export type AnnotationStatus = "proposta" | "aprovada" | "devolvida";

export interface QueueRow {
  id: string;
  status: AnnotationStatus;
  area: AreaCode;
  year: number;
  position: number;
  language: "ingles" | "espanhol" | null;
  /** O anotador deixou dúvida registrada: pede leitura mais atenta. */
  flagged: boolean;
}

const skillCode = z.string().regex(/^H\d{1,2}$/);

/** Proposta de anotação (anotacao/v1), no formato que o banco confere e aplica. */
export const payloadSchema = z.object({
  schema: z.literal("anotacao/v1"),
  skill: skillCode,
  skill_secondary: skillCode.nullable(),
  subject: z.uuid(),
  subject_code: z.string().min(1).max(40),
  content_dependency: z.number().int().min(0).max(3),
  evidence: z
    .array(
      z.object({
        block_id: z.string().min(1).max(40),
        start_utf16: z.number().int().min(0),
        end_utf16: z.number().int().min(1),
        quote: z.string().min(1).max(2000),
        rationale: z.string().max(600),
      }),
    )
    .max(8),
  distractors: z
    .array(
      z.object({
        key: z.string().min(1).max(2),
        type: z.string().min(1).max(40),
        secondary: z.string().max(40).nullable().optional(),
        rationale: z.string().max(600),
      }),
    )
    .max(4),
  steps: z.array(z.string().trim().min(3).max(1200)).min(1).max(12),
  uncertainties: z.array(z.string().max(600)).max(8),
});
export type AnnotationPayload = z.infer<typeof payloadSchema>;

export interface NamedSkill {
  code: string;
  description: string;
}

export interface AnnotationReview {
  id: string;
  status: AnnotationStatus;
  reviewNote: string | null;
  area: AreaCode;
  year: number;
  position: number;
  language: "ingles" | "espanhol" | null;
  question: StudyQuestion;
  /** Letra estável da alternativa correta (gabarito oficial). */
  correctKey: string | null;
  payload: AnnotationPayload;
  skill: NamedSkill | null;
  skillSecondary: NamedSkill | null;
  /** Caminho na árvore, do mais geral ao assunto. */
  subject: { code: string; path: string[] } | null;
  /** Marcações reais na prova (microdados do Inep); null quando a edição não tem o dado. */
  stats: { edition: number; correctRate: number; blankRate: number; byKey: Record<string, number> } | null;
}

export interface SubjectOption {
  id: string;
  code: string;
  label: string;
  /** Tema (e disciplina) a que o objeto pertence, para agrupar a lista. */
  group: string;
}

export interface ReviewOptions {
  skills: NamedSkill[];
  subjects: SubjectOption[];
  distractorTypes: { code: string; label: string }[];
}

export const DEPENDENCY: { value: number; label: string; hint: string }[] = [
  { value: 0, label: "0 · Só leitura", hint: "O texto traz tudo." },
  { value: 1, label: "1 · Conteúdo ajuda", hint: "Dá para resolver lendo, mas saber o assunto acelera." },
  { value: 2, label: "2 · Conteúdo necessário", hint: "Sem o assunto, o texto não basta." },
  { value: 3, label: "3 · Conteúdo decide", hint: "A resposta depende de conta, fórmula ou fato de memória." },
];

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;

/** "2024 · Q 136" ou "2025 · Q 3 (inglês)". */
export function rowLabel(r: Pick<QueueRow, "year" | "position" | "language">): string {
  return `${r.year} · Q ${r.position}${r.language ? ` (${LANG[r.language]})` : ""}`;
}

/**
 * Faixas de marca-texto por bloco. A posição gravada vale quando o trecho naquele ponto é o citado;
 * se o texto do bloco mudou de forma, procura a citação; sem achar, a evidência fica só na lista.
 */
export function evidenceMarks(
  evidence: AnnotationPayload["evidence"],
  blocks: QuestionBlock[],
): { marks: Record<string, MarkRange[]>; missing: number[] } {
  const text = new Map(blocks.map((b) => [b.id, b.text ?? ""]));
  const marks: Record<string, MarkRange[]> = {};
  const missing: number[] = [];
  evidence.forEach((e, i) => {
    const t = text.get(e.block_id);
    let start = -1;
    if (t !== undefined) start = t.slice(e.start_utf16, e.end_utf16) === e.quote ? e.start_utf16 : t.indexOf(e.quote);
    if (start < 0) {
      missing.push(i);
      return;
    }
    (marks[e.block_id] ??= []).push({ start, end: start + e.quote.length });
  });
  return { marks, missing };
}

/** Próxima questão por conferir depois de `from` (dá a volta); -1 quando a fila da área acabou. */
export function nextPending(rows: Pick<QueueRow, "status">[], from: number): number {
  for (let step = 1; step <= rows.length; step++) {
    const i = (from + step) % rows.length;
    if (rows[i]!.status === "proposta") return i;
  }
  return -1;
}

/** Quantas faltam por área. */
export function pendingByArea(rows: Pick<QueueRow, "area" | "status">[]): Record<AreaCode, { pending: number; total: number }> {
  const out = Object.fromEntries(AREAS.map((a) => [a, { pending: 0, total: 0 }])) as Record<AreaCode, { pending: number; total: number }>;
  for (const r of rows) {
    out[r.area].total += 1;
    if (r.status === "proposta") out[r.area].pending += 1;
  }
  return out;
}

/** Texto da resolução (um passo por linha) → lista de passos. */
export function stepsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

/** Problemas de um ajuste que dá para dizer antes de mandar ao banco. */
export function adjustProblems(p: AnnotationPayload, wrongKeys: string[]): string[] {
  const out: string[] = [];
  if (p.skill_secondary && p.skill_secondary === p.skill) out.push("A habilidade secundária repete a principal.");
  if (p.steps.length === 0) out.push("A resolução precisa de pelo menos um passo.");
  if (p.steps.some((s) => s.length < 3 || s.length > 1200)) out.push("Cada passo da resolução precisa ter de 3 a 1200 caracteres.");
  const keys = new Set(p.distractors.map((d) => d.key));
  const missing = wrongKeys.filter((k) => !keys.has(k));
  if (missing.length) out.push(`Falta classificar a alternativa ${missing.join(", ")}.`);
  if (p.distractors.some((d) => d.rationale.trim().length < 10)) out.push("Cada alternativa errada precisa de uma justificativa (10 caracteres ou mais).");
  return out;
}
