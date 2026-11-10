import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ProviderError, type Evaluator, type EvaluatorInput, type Usage } from "./consumer";

/**
 * Avaliador real da correção (F5-T09): uma chamada independente por etapa (A, B e, se a regra de
 * discrepância pedir, C). Só o texto enviado e a rubrica entram; nenhuma avaliação anterior.
 *
 * Modelo e limite de saída vêm da política de IA do banco (ai_model_policies), a mesma usada para
 * reservar o orçamento antes da chamada. Não há troca automática de modelo em recusa: outro modelo
 * cobraria um preço diferente do reservado. Recusa, corte por limite ou resposta fora do formato
 * voltam como resultado inválido, e o consumidor registra a falha sem guardar o texto.
 *
 * A chave é própria do Resolve (RESOLVE_ANTHROPIC_API_KEY) e o endereço é fixo, para nunca usar
 * credenciais do ambiente (ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL pertencem a outras ferramentas).
 */

export const API_BASE = "https://api.anthropic.com";
export const KEY_ENV = "RESOLVE_ANTHROPIC_API_KEY";

const Trecho = z.object({
  paragrafo: z.string().describe("id do parágrafo onde está o trecho"),
  citacao: z.string().describe("trecho copiado literalmente do texto, sem alterar nada"),
  comentario: z.string().describe("o que o trecho mostra sobre a competência"),
});

export const EvaluationSchema = z.object({
  notas: z.object({
    C1: z.number().int(),
    C2: z.number().int(),
    C3: z.number().int(),
    C4: z.number().int(),
    C5: z.number().int(),
  }),
  total: z.number().int(),
  justificativas: z.array(
    z.object({
      competencia: z.enum(["C1", "C2", "C3", "C4", "C5"]),
      motivo: z.string(),
      trechos: z.array(Trecho),
    }),
  ),
  intervencao: z.object({
    agente: z.string().nullable(),
    acao: z.string().nullable(),
    meio: z.string().nullable(),
    finalidade: z.string().nullable(),
    detalhamento: z.string().nullable(),
  }),
});
export type ClaudeEvaluation = z.infer<typeof EvaluationSchema>;

const SYSTEM = `Você corrige redações do ENEM pela matriz oficial de cinco competências (C1 a C5).
Cada competência recebe exatamente um dos degraus permitidos informados. O total é a soma das cinco.
Justifique cada nota com trechos copiados literalmente do texto (com o id do parágrafo). Se não houver
trecho que sustente um ponto, diga isso no motivo em vez de inventar.
Na proposta de intervenção (C5), identifique os cinco elementos: agente, ação, meio/modo, finalidade e
detalhamento. Use null para o elemento que não aparece no texto.
Não elogie nem suavize. Escreva em português, frases curtas, com o motivo de cada desconto.`;

export interface ClaudeEvaluatorOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  /** Para testes: cliente com a mesma interface do SDK. */
  client?: Pick<Anthropic, "messages">;
}

export class ClaudeEvaluator implements Evaluator {
  private readonly client: Pick<Anthropic, "messages">;

  constructor(private readonly opts: ClaudeEvaluatorOptions) {
    this.client =
      opts.client ?? new Anthropic({ apiKey: opts.apiKey, baseURL: API_BASE, maxRetries: 0 });
  }

  /** Cria o avaliador só se a chave própria existir; sem ela, a correção fica pendente. */
  static fromEnv(model: string, maxTokens: number): ClaudeEvaluator | null {
    const apiKey = process.env[KEY_ENV];
    return apiKey ? new ClaudeEvaluator({ apiKey, model, maxTokens }) : null;
  }

  async evaluate(input: EvaluatorInput, signal: AbortSignal): Promise<{ output: unknown; usage: Usage }> {
    const text = input.paragraphs.map((p) => `[${p.id}] ${p.text}`).join("\n\n");
    let response;
    try {
      response = await this.client.messages.parse(
        {
          model: this.opts.model,
          max_tokens: this.opts.maxTokens,
          system: SYSTEM,
          output_config: { effort: "low", format: zodOutputFormat(EvaluationSchema) },
          messages: [
            {
              role: "user",
              content: `Competências: ${input.rubric.codes.join(", ")}.\nDegraus permitidos: ${input.rubric.allowedScores.join(", ")}.\n\nRedação (cada parágrafo com seu id):\n\n${text}`,
            },
          ],
        },
        { signal },
      );
    } catch (e) {
      // Resposta conhecida do provedor (4xx/5xx): a chamada não foi processada.
      if (e instanceof Anthropic.APIError && typeof e.status === "number") throw new ProviderError(e.status);
      throw e; // tempo esgotado ou conexão: resultado desconhecido
    }
    const usage: Usage = {
      modelServed: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      requestId: (response as { _request_id?: string | null })._request_id ?? undefined,
    };
    if (response.stop_reason !== "end_turn" || !response.parsed_output) return { output: null, usage };
    return { output: toConsumerOutput(response.parsed_output, input), usage };
  }
}

/**
 * Converte para o formato que o consumidor confere ({scores, total}) e guarda as justificativas com
 * os trechos que de fato estão no parágrafo indicado; citação que não confere é descartada.
 */
export function toConsumerOutput(e: ClaudeEvaluation, input: EvaluatorInput) {
  const byId = new Map(input.paragraphs.map((p) => [p.id, p.text]));
  return {
    scores: { ...e.notas },
    total: e.total,
    justificativas: e.justificativas.map((j) => ({
      ...j,
      trechos: j.trechos.filter((t) => byId.get(t.paragrafo)?.includes(t.citacao)),
    })),
    intervencao: e.intervencao,
  };
}
