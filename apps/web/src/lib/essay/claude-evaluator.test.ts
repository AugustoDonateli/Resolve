import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ClaudeEvaluator, toConsumerOutput } = await import("./claude-evaluator");
const { ProviderError, validateEvaluation } = await import("./consumer");
const Anthropic = (await import("@anthropic-ai/sdk")).default;

const rubric = { codes: ["C1", "C2", "C3", "C4", "C5"], allowedScores: [0, 40, 80, 120, 160, 200] };
const input = {
  plainText: "a",
  paragraphs: [
    { id: "p1", text: "O Brasil desperdiça alimentos todos os dias." },
    { id: "p2", text: "Portanto, o governo deve criar campanhas nas escolas." },
  ],
  rubric,
  step: "avaliador_a" as const,
};
const parsed = {
  notas: { C1: 160, C2: 120, C3: 120, C4: 160, C5: 80 },
  total: 640,
  justificativas: [
    {
      competencia: "C5" as const,
      motivo: "Falta meio e detalhamento.",
      trechos: [
        { paragrafo: "p2", citacao: "o governo deve criar campanhas", comentario: "agente e ação" },
        { paragrafo: "p2", citacao: "trecho que não existe", comentario: "inventado" },
      ],
    },
  ],
  intervencao: { agente: "governo", acao: "criar campanhas", meio: null, finalidade: null, detalhamento: null },
};

function fakeClient(impl: () => Promise<unknown>) {
  return { messages: { parse: vi.fn(impl) } } as never;
}

describe("ClaudeEvaluator", () => {
  it("devolve notas no formato do consumidor e descarta citação que não está no texto", async () => {
    const client = fakeClient(async () => ({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 900, output_tokens: 700 },
      parsed_output: parsed,
    }));
    const ev = new ClaudeEvaluator({ apiKey: "x", model: "claude-opus-5-5", maxTokens: 4000, client });
    const r = await ev.evaluate(input, new AbortController().signal);
    expect(validateEvaluation(r.output, rubric)).toEqual({ scores: parsed.notas, total: 640 });
    const out = r.output as ReturnType<typeof toConsumerOutput>;
    expect(out.justificativas[0]!.trechos).toHaveLength(1);
    expect(r.usage).toMatchObject({ modelServed: "claude-opus-5-5", inputTokens: 900, outputTokens: 700 });
  });

  it("recusa ou corte por limite vira resultado inválido, com o uso registrado", async () => {
    for (const stop_reason of ["refusal", "max_tokens"]) {
      const client = fakeClient(async () => ({
        model: "m",
        stop_reason,
        usage: { input_tokens: 1, output_tokens: 2 },
        parsed_output: null,
      }));
      const ev = new ClaudeEvaluator({ apiKey: "x", model: "m", maxTokens: 10, client });
      const r = await ev.evaluate(input, new AbortController().signal);
      expect(r.output).toBeNull();
      expect(r.usage.outputTokens).toBe(2);
    }
  });

  it("erro conhecido do provedor vira ProviderError com o status", async () => {
    const client = fakeClient(async () => {
      throw new Anthropic.RateLimitError(429, undefined, "limite", new Headers());
    });
    const ev = new ClaudeEvaluator({ apiKey: "x", model: "m", maxTokens: 10, client });
    await expect(ev.evaluate(input, new AbortController().signal)).rejects.toBeInstanceOf(ProviderError);
  });

  it("sem a chave própria não cria avaliador (ignora ANTHROPIC_API_KEY)", async () => {
    const old = process.env.RESOLVE_ANTHROPIC_API_KEY;
    delete process.env.RESOLVE_ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "de-outra-ferramenta";
    expect(ClaudeEvaluator.fromEnv("m", 10)).toBeNull();
    if (old) process.env.RESOLVE_ANTHROPIC_API_KEY = old;
  });
});
