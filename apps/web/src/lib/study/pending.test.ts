import { describe, expect, it } from "vitest";
import {
  clearPending,
  flushPending,
  pendingFor,
  savePending,
  type KeyValue,
  type PendingAnswer,
} from "./pending";

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const p = (
  item: string,
  action = `act-${item}`,
  session = "s1",
): PendingAnswer => ({
  sessionId: session,
  sessionItemId: item,
  actionId: action,
  alternativeKey: "B",
  alternativeId: "alt",
  activeMs: 1000,
  savedAt: "2026-11-10T12:00:00Z",
});

describe("respostas pendentes", () => {
  it("guarda uma por questão, separa por sessão e sobrevive a dados corrompidos", () => {
    const s = memory();
    savePending(s, p("i1"));
    savePending(s, p("i1", "act-i1"));
    savePending(s, p("i2"));
    savePending(s, p("x", "act-x", "s2"));
    expect(pendingFor(s, "s1").map((x) => x.sessionItemId)).toEqual([
      "i1",
      "i2",
    ]);
    clearPending(s, "i1");
    expect(pendingFor(s, "s1").map((x) => x.sessionItemId)).toEqual(["i2"]);
    s.data.set("resolve:respostas-pendentes", "{quebrado");
    expect(pendingFor(s, "s1")).toEqual([]);
  });

  it("reenvia com o mesmo identificador; rede mantém, sucesso e erro final limpam", async () => {
    const s = memory();
    savePending(s, p("ok"));
    savePending(s, p("rede"));
    savePending(s, p("final"));
    const seen: string[] = [];
    const r = await flushPending(s, "s1", async (x) => {
      seen.push(x.actionId);
      if (x.sessionItemId === "ok") return { ok: true };
      return { ok: false, final: x.sessionItemId === "final" };
    });
    expect(seen).toEqual(["act-ok", "act-rede", "act-final"]);
    expect(r).toEqual({ sent: ["ok"], failedFinal: ["final"], kept: ["rede"] });
    expect(pendingFor(s, "s1").map((x) => x.sessionItemId)).toEqual(["rede"]);
    // segunda rodada (conexão voltou): mesmo identificador de ação
    const again = await flushPending(s, "s1", async (x) =>
      x.actionId === "act-rede" ? { ok: true } : { ok: false, final: false },
    );
    expect(again.sent).toEqual(["rede"]);
    expect(s.data.size).toBe(0);
  });

  it("armazenamento que falha não derruba o fluxo", () => {
    const broken: KeyValue = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cheio");
      },
      removeItem: () => {},
    };
    expect(() => savePending(broken, p("i1"))).not.toThrow();
    expect(pendingFor(broken, "s1")).toEqual([]);
  });
});
