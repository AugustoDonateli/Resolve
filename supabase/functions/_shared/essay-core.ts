/**
 * Núcleo da correção de redação, sem dependências: usado pela Edge Function `corrigir-redacao` (Deno)
 * e pelos testes do app (Vitest). O banco faz o trabalho pesado (reserva, liquidação, etapas A → B →
 * discrepância → C, consolidação); este módulo orquestra uma etapa:
 *   1. pega o trabalho; 2. lê o texto submetido e a rubrica; 3. chama o avaliador com tempo limite;
 *   4. confere o resultado contra a rubrica; 5. conclui (com anotações presas ao texto) ou registra a falha.
 * Nada do texto da redação nem da resposta do modelo vai para o registro de erro.
 */

export type Step = "avaliador_a" | "avaliador_b" | "avaliador_c";

export interface Claim {
  runId: string;
  jobId: string;
  versionId: string;
  step: Step;
  attempt: number;
}

export interface Usage {
  modelServed: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
}

export interface Rubric {
  codes: string[];
  allowedScores: number[];
}

export interface Paragraph {
  id: string;
  text: string;
}

export interface EvaluatorInput {
  /** Só o texto enviado e a rubrica: nenhuma avaliação anterior entra (independência entre avaliadores). */
  paragraphs: Paragraph[];
  rubric: Rubric;
  step: Step;
}

export const INTERVENTION = ["agente", "acao", "meio", "finalidade", "detalhamento"] as const;
export type InterventionElement = (typeof INTERVENTION)[number];

export interface Annotation {
  competency: string;
  intervention_element?: InterventionElement;
  absent: boolean;
  paragraph_id?: string;
  start_utf16?: number;
  end_utf16?: number;
  comment: string;
}

export interface EvaluationOutput {
  scores: Record<string, number>;
  total: number;
  feedback: string;
  intervention: Record<InterventionElement, string | null>;
  annotations: Annotation[];
}

export type FailKind = "erro" | "resultado_invalido" | "desconhecido";

export interface QueuePort {
  claim(workerId: string): Promise<Claim | null>;
  load(runId: string): Promise<{ paragraphs: Paragraph[]; rubric: Rubric }>;
  complete(runId: string, result: EvaluationOutput, usage: Usage, promptVersion: string): Promise<string>;
  fail(runId: string, kind: FailKind, code: string, usage?: Usage): Promise<string>;
}

export interface Evaluator {
  readonly promptVersion: string;
  evaluate(input: EvaluatorInput, signal: AbortSignal): Promise<{ output: unknown; usage: Usage }>;
}

/** Erro do provedor com resposta conhecida: a chamada não foi processada (sem cobrança de saída). */
export class ProviderError extends Error {
  constructor(readonly status: number) {
    super(`provider ${status}`);
  }
}

export const PROMPT_VERSION = "correcao-v1";

export const SYSTEM_PROMPT = `Você corrige redações do ENEM pela matriz oficial de cinco competências (C1 a C5).
Cada competência recebe exatamente um dos degraus permitidos informados. O total é a soma das cinco.
Justifique cada nota com trechos copiados literalmente do texto, com o id do parágrafo. Se não houver
trecho que sustente um ponto, diga isso no comentário em vez de inventar.
Na proposta de intervenção (C5), identifique os cinco elementos: agente, ação, meio/modo, finalidade e
detalhamento. Use null para o elemento que não aparece no texto.
Não elogie nem suavize. Escreva em português, frases curtas, com o motivo de cada desconto.`;

export function userPrompt(input: EvaluatorInput): string {
  const text = input.paragraphs.map((p) => `[${p.id}] ${p.text}`).join("\n\n");
  return `Competências: ${input.rubric.codes.join(", ")}.\nDegraus permitidos: ${input.rubric.allowedScores.join(", ")}.\n\nRedação (cada parágrafo com seu id):\n\n${text}`;
}

/** Formato pedido ao modelo (saída estruturada). */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["notas", "total", "resumo", "trechos", "intervencao"],
  properties: {
    notas: {
      type: "object",
      additionalProperties: false,
      required: ["C1", "C2", "C3", "C4", "C5"],
      properties: Object.fromEntries(["C1", "C2", "C3", "C4", "C5"].map((c) => [c, { type: "integer" }])),
    },
    total: { type: "integer" },
    resumo: { type: "string", description: "o que mais pesou na nota, em até cinco frases" },
    trechos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["competencia", "paragrafo", "citacao", "comentario"],
        properties: {
          competencia: { type: "string", enum: ["C1", "C2", "C3", "C4", "C5"] },
          paragrafo: { type: "string" },
          citacao: { type: "string", description: "copiada literalmente do parágrafo" },
          comentario: { type: "string" },
        },
      },
    },
    intervencao: {
      type: "object",
      additionalProperties: false,
      required: [...INTERVENTION],
      properties: Object.fromEntries(INTERVENTION.map((k) => [k, { type: ["string", "null"] }])),
    },
  },
} as const;

/** Notas conferidas contra a rubrica: exatamente as competências, degraus permitidos e total igual à soma. */
export function validateScores(
  scores: unknown,
  total: unknown,
  rubric: Rubric,
): { scores: Record<string, number>; total: number } | null {
  if (typeof scores !== "object" || scores === null || typeof total !== "number") return null;
  const entries = Object.entries(scores as Record<string, unknown>);
  if (entries.map(([k]) => k).sort().join() !== [...rubric.codes].sort().join()) return null;
  if (!entries.every(([, v]) => typeof v === "number" && Number.isInteger(v) && rubric.allowedScores.includes(v))) return null;
  if (entries.reduce((s, [, v]) => s + (v as number), 0) !== total) return null;
  return { scores: Object.fromEntries(entries) as Record<string, number>, total };
}

/**
 * Converte a resposta do modelo em avaliação gravável. Trechos viram anotações com a posição UTF-16
 * dentro do parágrafo (o JavaScript já conta em UTF-16); citação que não está no parágrafo é descartada.
 * Elemento da intervenção ausente vira anotação de ausência, sem trecho.
 */
export function toEvaluation(raw: unknown, input: EvaluatorInput): EvaluationOutput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const valid = validateScores(r.notas, r.total, input.rubric);
  if (!valid) return null;
  const byId = new Map(input.paragraphs.map((p) => [p.id, p.text]));
  const annotations: Annotation[] = [];
  for (const t of Array.isArray(r.trechos) ? r.trechos : []) {
    const { competencia, paragrafo, citacao, comentario } = (t ?? {}) as Record<string, unknown>;
    if (typeof competencia !== "string" || !input.rubric.codes.includes(competencia)) continue;
    if (typeof paragrafo !== "string" || typeof citacao !== "string" || !citacao.trim()) continue;
    if (typeof comentario !== "string" || !comentario.trim()) continue;
    const start = byId.get(paragrafo)?.indexOf(citacao) ?? -1;
    if (start < 0) continue;
    annotations.push({
      competency: competencia,
      absent: false,
      paragraph_id: paragrafo,
      start_utf16: start,
      end_utf16: start + citacao.length,
      comment: comentario.trim().slice(0, 2000),
    });
  }
  const iv = (typeof r.intervencao === "object" && r.intervencao ? r.intervencao : {}) as Record<string, unknown>;
  const intervention = Object.fromEntries(
    INTERVENTION.map((k) => [k, typeof iv[k] === "string" && (iv[k] as string).trim() ? (iv[k] as string).trim() : null]),
  ) as Record<InterventionElement, string | null>;
  for (const k of INTERVENTION) {
    if (intervention[k] === null && input.rubric.codes.includes("C5"))
      annotations.push({ competency: "C5", intervention_element: k, absent: true, comment: `Elemento ausente: ${k}.` });
  }
  return {
    ...valid,
    feedback: typeof r.resumo === "string" ? r.resumo.trim().slice(0, 8000) : "",
    intervention,
    annotations,
  };
}

export type StepOutcome = "vazio" | "ok" | FailKind;

export async function runOneStep(
  port: QueuePort,
  evaluator: Evaluator,
  opts: { workerId: string; timeoutMs: number },
): Promise<StepOutcome> {
  const claim = await port.claim(opts.workerId);
  if (!claim) return "vazio";
  let loaded: Awaited<ReturnType<QueuePort["load"]>>;
  try {
    loaded = await port.load(claim.runId);
  } catch {
    // nada foi enviado ao provedor: libera a reserva
    await port.fail(claim.runId, "erro", "leitura_falhou");
    return "erro";
  }
  const input: EvaluatorInput = { paragraphs: loaded.paragraphs, rubric: loaded.rubric, step: claim.step };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const { output, usage } = await evaluator.evaluate(input, ctrl.signal);
    const evaluation = toEvaluation(output, input);
    if (!evaluation) {
      await port.fail(claim.runId, "resultado_invalido", "schema_invalido", usage);
      return "resultado_invalido";
    }
    await port.complete(claim.runId, evaluation, usage, evaluator.promptVersion);
    return "ok";
  } catch (err) {
    if (err instanceof ProviderError) {
      await port.fail(claim.runId, "erro", `http:${err.status}`);
      return "erro";
    }
    // tempo esgotado ou falha de rede depois do envio: a chamada pode ter sido processada e cobrada
    await port.fail(claim.runId, "desconhecido", ctrl.signal.aborted ? "timeout" : "rede");
    return "desconhecido";
  } finally {
    clearTimeout(timer);
  }
}
