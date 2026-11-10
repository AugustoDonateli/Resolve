import { describe, expect, it } from "vitest";
import { ProviderError, runOneStep, validateEvaluation, type Claim, type Evaluator, type FailKind, type QueuePort, type Rubric } from "./consumer";

const rubric: Rubric = { codes: ["C1", "C2", "C3", "C4", "C5"], allowedScores: [0, 40, 80, 120, 160, 200] };
const ok = { scores: { C1: 160, C2: 160, C3: 120, C4: 160, C5: 120 }, total: 720 };
const usage = { modelServed: "modelo-falso", inputTokens: 3000, outputTokens: 1200, requestId: "req-1" };

function fakePort(claim: Claim | null = { runId: "r1", jobId: "j1", versionId: "v1", step: "avaliador_a", attempt: 1 }) {
  const calls: { complete: unknown[]; fail: { kind: FailKind; code: string; usage?: unknown }[]; seen: unknown[] } = { complete: [], fail: [], seen: [] };
  const port: QueuePort = {
    claim: async () => claim,
    loadVersion: async () => ({ plainText: "Parágrafo um.\n\nParágrafo dois.", paragraphs: [{ id: "p1", text: "Parágrafo um." }, { id: "p2", text: "Parágrafo dois." }] }),
    loadRubric: async () => rubric,
    complete: async (_r, result, u) => (calls.complete.push({ result, u }), "ok"),
    fail: async (_r, kind, code, u) => (calls.fail.push({ kind, code, usage: u }), kind),
  };
  return { port, calls };
}

const evaluator = (fn: Evaluator["evaluate"]): Evaluator => ({ evaluate: fn });
const opts = { workerId: "w1", timeoutMs: 50 };

describe("validateEvaluation", () => {
  it("aceita cinco competências nos degraus com total igual à soma", () => {
    expect(validateEvaluation(ok, rubric)).toEqual(ok);
  });
  it("recusa degrau fora da rubrica, total errado, competência faltando ou sobrando", () => {
    expect(validateEvaluation({ ...ok, scores: { ...ok.scores, C1: 150 } }, rubric)).toBeNull();
    expect(validateEvaluation({ ...ok, total: 800 }, rubric)).toBeNull();
    const four = Object.fromEntries(Object.entries(ok.scores).filter(([k]) => k !== "C5"));
    expect(validateEvaluation({ scores: four, total: 600 }, rubric)).toBeNull();
    expect(validateEvaluation({ scores: { ...ok.scores, C6: 0 }, total: 720 }, rubric)).toBeNull();
    expect(validateEvaluation("texto livre", rubric)).toBeNull();
  });
});

describe("runOneStep", () => {
  it("fila vazia não chama o avaliador", async () => {
    const { port } = fakePort(null);
    let called = false;
    expect(await runOneStep(port, evaluator(async () => ((called = true), { output: ok, usage })), opts)).toBe("vazio");
    expect(called).toBe(false);
  });

  it("resultado válido conclui com o uso real; o avaliador recebe só texto e rubrica", async () => {
    const { port, calls } = fakePort();
    let input: unknown;
    expect(await runOneStep(port, evaluator(async (i) => ((input = i), { output: ok, usage })), opts)).toBe("ok");
    expect(calls.complete).toEqual([{ result: ok, u: usage }]);
    expect(Object.keys(input as object).sort()).toEqual(["paragraphs", "plainText", "rubric", "step"]);
  });

  it("resultado fora da rubrica: falha 'resultado_invalido' registrando o consumo", async () => {
    const { port, calls } = fakePort();
    expect(await runOneStep(port, evaluator(async () => ({ output: { ...ok, total: 999 }, usage })), opts)).toBe("resultado_invalido");
    expect(calls.fail).toEqual([{ kind: "resultado_invalido", code: "schema_invalido", usage }]);
  });

  it("erro conhecido do provedor: falha 'erro' com código, sem texto", async () => {
    const { port, calls } = fakePort();
    expect(await runOneStep(port, evaluator(async () => Promise.reject(new ProviderError(529))), opts)).toBe("erro");
    expect(calls.fail).toEqual([{ kind: "erro", code: "http:529", usage: undefined }]);
  });

  it("tempo esgotado: resultado desconhecido (reserva vai para reconciliar)", async () => {
    const { port, calls } = fakePort();
    const slow = evaluator((_i, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort")))));
    expect(await runOneStep(port, slow, opts)).toBe("desconhecido");
    expect(calls.fail).toEqual([{ kind: "desconhecido", code: "timeout", usage: undefined }]);
  });

  it("falha de rede depois do envio também é desconhecida; a mensagem do erro não vai para o registro", async () => {
    const { port, calls } = fakePort();
    expect(await runOneStep(port, evaluator(async () => Promise.reject(new Error("ECONNRESET com trecho da redação"))), opts)).toBe("desconhecido");
    expect(calls.fail[0]).toEqual({ kind: "desconhecido", code: "rede", usage: undefined });
  });

  it("falha ao ler a versão antes de chamar o provedor: 'erro' (reserva liberada)", async () => {
    const { port, calls } = fakePort();
    port.loadVersion = async () => Promise.reject(new Error("db"));
    let called = false;
    expect(await runOneStep(port, evaluator(async () => ((called = true), { output: ok, usage })), opts)).toBe("erro");
    expect(called).toBe(false);
    expect(calls.fail[0]?.code).toBe("leitura_falhou");
  });
});
