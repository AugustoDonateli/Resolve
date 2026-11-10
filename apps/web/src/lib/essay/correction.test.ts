import { describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  runOneStep,
  toEvaluation,
  validateScores,
  type Evaluator,
  type QueuePort,
} from "../../../../../supabase/functions/_shared/essay-core";

/**
 * Núcleo da correção (o mesmo código da Edge Function) com porta e avaliador DE TESTE.
 * Nenhum resultado daqui é correção real: o avaliador de teste devolve notas fixas.
 */
const rubric = { codes: ["C1", "C2", "C3", "C4", "C5"], allowedScores: [0, 40, 80, 120, 160, 200] };
const paragraphs = [
  { id: "p1", text: "O Brasil desperdiça alimentos todos os dias." },
  { id: "p2", text: "Portanto, o governo deve criar campanhas nas escolas." },
];
const modelOutput = {
  notas: { C1: 160, C2: 120, C3: 120, C4: 160, C5: 80 },
  total: 640,
  resumo: "teste",
  trechos: [
    { competencia: "C5", paragrafo: "p2", citacao: "o governo deve criar campanhas", comentario: "agente e ação" },
    { competencia: "C1", paragrafo: "p1", citacao: "trecho que não existe", comentario: "inventado" },
  ],
  intervencao: { agente: "governo", acao: "criar campanhas", meio: null, finalidade: null, detalhamento: null },
};
const usage = { modelServed: "avaliador-de-teste", inputTokens: 10, outputTokens: 20 };

function fakePort(over: Partial<QueuePort> = {}) {
  const calls: { complete: unknown[][]; fail: unknown[][] } = { complete: [], fail: [] };
  const port: QueuePort = {
    claim: async () => ({ runId: "r1", jobId: "j1", versionId: "v1", step: "avaliador_a", attempt: 1 }),
    load: async () => ({ paragraphs, rubric }),
    complete: async (...a) => (calls.complete.push(a), "ok"),
    fail: async (...a) => (calls.fail.push(a), String(a[1])),
    ...over,
  };
  return { port, calls };
}
const testEvaluator = (impl: Evaluator["evaluate"]): Evaluator => ({ promptVersion: "teste-integracao", evaluate: vi.fn(impl) });

describe("notas e trechos", () => {
  it("aceita cinco competências nos degraus com total igual à soma; recusa o resto", () => {
    expect(validateScores(modelOutput.notas, 640, rubric)).not.toBeNull();
    expect(validateScores({ ...modelOutput.notas, C1: 150 }, 630, rubric)).toBeNull();
    expect(validateScores(modelOutput.notas, 600, rubric)).toBeNull();
    const faltando = Object.fromEntries(Object.entries(modelOutput.notas).filter(([k]) => k !== "C5"));
    expect(validateScores(faltando, 560, rubric)).toBeNull();
  });

  it("trecho vira anotação com posição UTF-16 no parágrafo; citação inexistente é descartada; elemento ausente vira ausência", () => {
    const e = toEvaluation(modelOutput, { paragraphs, rubric, step: "avaliador_a" })!;
    const trechos = e.annotations.filter((a) => !a.absent);
    expect(trechos).toHaveLength(1);
    const t = trechos[0]!;
    expect(paragraphs[1]!.text.slice(t.start_utf16, t.end_utf16)).toBe("o governo deve criar campanhas");
    expect(e.annotations.filter((a) => a.absent).map((a) => a.intervention_element)).toEqual(["meio", "finalidade", "detalhamento"]);
  });
});

describe("uma etapa da fila", () => {
  it("fila vazia não chama o avaliador", async () => {
    const ev = testEvaluator(async () => ({ output: modelOutput, usage }));
    const { port } = fakePort({ claim: async () => null });
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 1000 })).toBe("vazio");
    expect(ev.evaluate).not.toHaveBeenCalled();
  });

  it("resultado válido conclui com uso real e versão do prompt; o avaliador recebe só texto e rubrica", async () => {
    const ev = testEvaluator(async () => ({ output: modelOutput, usage }));
    const { port, calls } = fakePort();
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 1000 })).toBe("ok");
    expect(Object.keys((ev.evaluate as ReturnType<typeof vi.fn>).mock.calls[0]![0]).sort()).toEqual(["paragraphs", "rubric", "step"]);
    expect(calls.complete[0]![3]).toBe("teste-integracao");
  });

  it("resultado fora da rubrica: 'resultado_invalido' registrando o consumo", async () => {
    const ev = testEvaluator(async () => ({ output: { ...modelOutput, total: 1 }, usage }));
    const { port, calls } = fakePort();
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 1000 })).toBe("resultado_invalido");
    expect(calls.fail[0]).toEqual(["r1", "resultado_invalido", "schema_invalido", usage]);
  });

  it("erro conhecido do provedor: 'erro' com código curto, sem texto", async () => {
    const ev = testEvaluator(async () => {
      throw new ProviderError(529);
    });
    const { port, calls } = fakePort();
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 1000 })).toBe("erro");
    expect(calls.fail[0]).toEqual(["r1", "erro", "http:529"]);
  });

  it("tempo esgotado: resultado desconhecido (a reserva vai para reconciliar)", async () => {
    const ev = testEvaluator(
      (_i, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort")))),
    );
    const { port, calls } = fakePort();
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 20 })).toBe("desconhecido");
    expect(calls.fail[0]).toEqual(["r1", "desconhecido", "timeout"]);
  });

  it("falha ao ler o texto antes de chamar o provedor: 'erro' (reserva liberada)", async () => {
    const ev = testEvaluator(async () => ({ output: modelOutput, usage }));
    const { port, calls } = fakePort({ load: async () => Promise.reject(new Error("x")) });
    expect(await runOneStep(port, ev, { workerId: "w", timeoutMs: 1000 })).toBe("erro");
    expect(calls.fail[0]).toEqual(["r1", "erro", "leitura_falhou"]);
    expect(ev.evaluate).not.toHaveBeenCalled();
  });
});
