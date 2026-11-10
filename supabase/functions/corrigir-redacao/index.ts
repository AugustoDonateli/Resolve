// Serviço de correção de redação (Edge Function do Supabase).
// Roda fora do app: a credencial de serviço do banco existe só aqui, injetada pelo Supabase.
// A chave da API é a própria do Resolve (RESOLVE_ANTHROPIC_API_KEY, segredo da função); sem ela o serviço
// responde "pendente" e não pega nenhum trabalho da fila (nada é reservado nem cobrado).
// Processa até alguns trabalhos por chamada; é chamado depois de cada envio e periodicamente.
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  OUTPUT_SCHEMA,
  PROMPT_VERSION,
  ProviderError,
  SYSTEM_PROMPT,
  runOneStep,
  userPrompt,
  type Claim,
  type Evaluator,
  type QueuePort,
} from "../_shared/essay-core.ts";

const MAX_STEPS = 6;
const TIMEOUT_MS = 120_000;

function port(db: ReturnType<typeof createClient>): QueuePort {
  return {
    async claim(workerId) {
      const { data, error } = await db.rpc("worker_claim", { p_worker: workerId });
      if (error) throw new Error("claim_failed");
      const row = (data as Record<string, unknown>[] | null)?.[0];
      if (!row) return null;
      return {
        runId: row.run_id as string,
        jobId: row.job_id as string,
        versionId: row.version_id as string,
        step: row.step as Claim["step"],
        attempt: row.attempt as number,
      };
    },
    async load(runId) {
      const { data, error } = await db.rpc("worker_load", { p_run: runId });
      if (error || !data) throw new Error("load_failed");
      const d = data as { paragraphs: { id: string; text: string }[]; codes: string[]; allowed_scores: number[] };
      return { paragraphs: d.paragraphs, rubric: { codes: d.codes, allowedScores: d.allowed_scores } };
    },
    async complete(runId, r, usage, promptVersion) {
      const { data, error } = await db.rpc("worker_complete", {
        p_run: runId,
        p_scores: r.scores,
        p_total: r.total,
        p_feedback: r.feedback,
        p_intervention: r.intervention,
        p_annotations: r.annotations,
        p_model_served: usage.modelServed,
        p_prompt_version: promptVersion,
        p_in: usage.inputTokens,
        p_out: usage.outputTokens,
        p_request_id: usage.requestId ?? null,
      });
      if (error) throw new Error("complete_failed");
      return data as string;
    },
    async fail(runId, kind, code, usage) {
      const { data } = await db.rpc("worker_fail", {
        p_run: runId,
        p_kind: kind,
        p_error: code,
        p_in: usage?.inputTokens ?? null,
        p_out: usage?.outputTokens ?? null,
        p_model_served: usage?.modelServed ?? null,
        p_request_id: usage?.requestId ?? null,
      });
      return (data as string) ?? kind;
    },
  };
}

function claudeEvaluator(apiKey: string, model: string, maxTokens: number): Evaluator {
  // Endereço fixo e chave explícita: nunca usa ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL do ambiente.
  const client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com", maxRetries: 0 });
  return {
    promptVersion: PROMPT_VERSION,
    async evaluate(input, signal) {
      let res;
      try {
        res = await client.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
            messages: [{ role: "user", content: userPrompt(input) }],
          },
          { signal },
        );
      } catch (e) {
        if (e instanceof Anthropic.APIError && typeof e.status === "number") throw new ProviderError(e.status);
        throw e;
      }
      const usage = {
        modelServed: res.model,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        requestId: (res as { _request_id?: string | null })._request_id ?? undefined,
      };
      // Recusa ou corte por limite: resultado inválido (o consumo é registrado pelo consumidor).
      if (res.stop_reason !== "end_turn") return { output: null, usage };
      const text = res.content.find((b) => b.type === "text");
      try {
        return { output: text && text.type === "text" ? JSON.parse(text.text) : null, usage };
      } catch {
        return { output: null, usage };
      }
    },
  };
}

Deno.serve(async () => {
  const apiKey = Deno.env.get("RESOLVE_ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json({ status: "pendente", motivo: "RESOLVE_ANTHROPIC_API_KEY não configurada" }, { status: 503 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const q = port(db);
  const workerId = `edge-${crypto.randomUUID().slice(0, 8)}`;
  const outcomes: string[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    // O modelo e o limite vêm da política do trabalho (a mesma usada para reservar o orçamento).
    let evaluator: Evaluator | null = null;
    const wrapped: QueuePort = {
      ...q,
      async load(runId) {
        const { data } = await db.rpc("worker_load", { p_run: runId });
        const d = data as { model: string; max_output_tokens: number } | null;
        if (!d) throw new Error("load_failed");
        evaluator = claudeEvaluator(apiKey, d.model, d.max_output_tokens);
        return q.load(runId);
      },
    };
    const lazy: Evaluator = {
      promptVersion: PROMPT_VERSION,
      evaluate: (input, signal) => evaluator!.evaluate(input, signal),
    };
    const outcome = await runOneStep(wrapped, lazy, { workerId, timeoutMs: TIMEOUT_MS }).catch(() => "erro_interno");
    outcomes.push(outcome);
    if (outcome === "vazio" || outcome === "erro_interno") break;
  }
  return Response.json({ status: "ok", etapas: outcomes });
});
