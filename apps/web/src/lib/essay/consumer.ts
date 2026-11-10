/**
 * Consumidor de uma etapa da fila de correção (F5-T08).
 *
 * O banco faz o trabalho pesado, em private.claim_next_job / complete_run / fail_run / reconcile_reservation:
 * reserva antes da chamada, liquidação, entrega repetida inofensiva e limite de tentativas. Este módulo só
 * orquestra uma etapa:
 *   1. pega o trabalho;
 *   2. lê o texto da versão enviada;
 *   3. chama o avaliador com tempo limite;
 *   4. confere o resultado contra a rubrica;
 *   5. conclui ou registra a falha com um código curto.
 * Nada de texto da redação ou da resposta do modelo vai para o registro de erro.
 *
 * O avaliador real (F5-T09) e a conexão com o banco do serviço de correção entram depois. Nos testes, a
 * porta e o avaliador são falsos.
 */

export interface Claim {
  runId: string;
  jobId: string;
  versionId: string;
  step: "avaliador_a" | "avaliador_b" | "avaliador_c";
  attempt: number;
}

export interface Usage {
  modelServed: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
}

export interface EvaluationOutput {
  scores: Record<string, number>;
  total: number;
}

export interface EvaluatorInput {
  /** Só o texto enviado e a rubrica: nenhuma avaliação anterior entra (independência entre avaliadores). */
  plainText: string;
  paragraphs: { id: string; text: string }[];
  rubric: Rubric;
  step: Claim["step"];
}

export interface Rubric {
  codes: string[];
  allowedScores: number[];
}

export type FailKind = "erro" | "resultado_invalido" | "desconhecido";

export interface QueuePort {
  claim(workerId: string): Promise<Claim | null>;
  loadVersion(versionId: string): Promise<{ plainText: string; paragraphs: { id: string; text: string }[] }>;
  loadRubric(jobId: string): Promise<Rubric>;
  complete(runId: string, result: EvaluationOutput, usage: Usage): Promise<string>;
  fail(runId: string, kind: FailKind, code: string, usage?: Usage): Promise<string>;
}

export interface Evaluator {
  evaluate(input: EvaluatorInput, signal: AbortSignal): Promise<{ output: unknown; usage: Usage }>;
}

/** Erro do provedor com resposta conhecida: a chamada não foi processada (sem cobrança de saída). */
export class ProviderError extends Error {
  constructor(readonly status: number) {
    super(`provider ${status}`);
  }
}

/** Resultado conferido contra a rubrica: exatamente as competências, degraus permitidos e total igual à soma. */
export function validateEvaluation(output: unknown, rubric: Rubric): EvaluationOutput | null {
  if (typeof output !== "object" || output === null) return null;
  const { scores, total } = output as { scores?: unknown; total?: unknown };
  if (typeof scores !== "object" || scores === null || typeof total !== "number") return null;
  const entries = Object.entries(scores as Record<string, unknown>);
  const keys = entries.map(([k]) => k).sort();
  if (keys.join() !== [...rubric.codes].sort().join()) return null;
  if (!entries.every(([, v]) => typeof v === "number" && Number.isInteger(v) && rubric.allowedScores.includes(v))) return null;
  const sum = entries.reduce((s, [, v]) => s + (v as number), 0);
  if (sum !== total) return null;
  return { scores: Object.fromEntries(entries) as Record<string, number>, total };
}

export type StepOutcome = "vazio" | "ok" | FailKind;

export async function runOneStep(port: QueuePort, evaluator: Evaluator, opts: { workerId: string; timeoutMs: number }): Promise<StepOutcome> {
  const claim = await port.claim(opts.workerId);
  if (!claim) return "vazio";
  let version: Awaited<ReturnType<QueuePort["loadVersion"]>>;
  let rubric: Rubric;
  try {
    [version, rubric] = await Promise.all([port.loadVersion(claim.versionId), port.loadRubric(claim.jobId)]);
  } catch {
    // nada foi enviado ao provedor: libera a reserva
    await port.fail(claim.runId, "erro", "leitura_falhou");
    return "erro";
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const { output, usage } = await evaluator.evaluate({ plainText: version.plainText, paragraphs: version.paragraphs, rubric, step: claim.step }, ctrl.signal);
    const valid = validateEvaluation(output, rubric);
    if (!valid) {
      await port.fail(claim.runId, "resultado_invalido", "schema_invalido", usage);
      return "resultado_invalido";
    }
    await port.complete(claim.runId, valid, usage);
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
