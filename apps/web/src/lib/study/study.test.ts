import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EventQueue, type QueuedEvent } from "./events";
import { ERROR_REASONS } from "./reasons";
import { classify, withSameAction, type Outcome } from "./retry";

const migrations = path.resolve(__dirname, "../../../../../supabase/migrations");
const sql = readdirSync(migrations)
  .filter((f) => f.includes("sessoes_tentativas"))
  .map((f) => readFileSync(path.join(migrations, f), "utf8"))
  .join("\n");

describe("motivos de erro", () => {
  it("a lista do app é a mesma do banco", () => {
    const m = sql.match(/select r in \(([^)]*)\)/);
    const db = (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(ERROR_REASONS.map((r) => r.code)).toEqual(db);
  });
  it("'não informado' é o primeiro e é o padrão explícito no banco", () => {
    expect(ERROR_REASONS[0]?.code).toBe("not_reported");
    expect(sql).toContain("reason text not null default 'not_reported'");
  });
});

describe("reenvio com o mesmo identificador de ação", () => {
  it("falha transitória: reenvia com o mesmo id até confirmar", async () => {
    const seen: string[] = [];
    let n = 0;
    const r = await withSameAction<string>(
      "acao-1",
      async (id) => {
        seen.push(id);
        n += 1;
        return n < 3 ? { ok: false, error: "rede", final: false } : { ok: true, value: "tentativa-1" };
      },
      { sleep: async () => {} },
    );
    expect(r).toEqual({ ok: true, value: "tentativa-1" });
    expect(seen).toEqual(["acao-1", "acao-1", "acao-1"]);
  });
  it("erro definitivo não é reenviado", async () => {
    let calls = 0;
    const r = await withSameAction<string>("a", async () => {
      calls += 1;
      return { ok: false, ...classify("ERROR: resolve_already_answered") } as Outcome<string>;
    }, { sleep: async () => {} });
    expect(calls).toBe(1);
    expect(r).toEqual({ ok: false, error: "resolve_already_answered", final: true });
  });
});

describe("fila de eventos", () => {
  const fixedNow = () => new Date("2026-11-09T12:00:00.000Z");

  it("identificadores estáveis, ordem preservada e reenvio do mesmo lote após falha", async () => {
    const q = new EventQueue("sess1", fixedNow);
    q.push("questao_aberta", "item-1", { origem: "inicio" });
    q.push("alternativa_marcada", "item-1", { alternativa: "C" });
    q.push("ajuda_vista", "item-1", {});
    const batches: QueuedEvent[][] = [];
    let fail = true;
    const send = async (b: QueuedEvent[]) => {
      batches.push(b.map((e) => ({ ...e })));
      if (fail) {
        fail = false;
        return { ok: false };
      }
      return { ok: true };
    };
    expect(await q.flush(send)).toBe(0);
    expect(q.size).toBe(3);
    expect(await q.flush(send)).toBe(3);
    expect(q.size).toBe(0);
    expect(batches[0]?.map((e) => e.client_event_id)).toEqual(["sess1-1", "sess1-2", "sess1-3"]);
    expect(batches[1]).toEqual(batches[0]);
    expect(batches[1]?.map((e) => e.type)).toEqual(["questao_aberta", "alternativa_marcada", "ajuda_vista"]);
  });

  it("lotes de no máximo 100", async () => {
    const q = new EventQueue("s", fixedNow);
    for (let i = 0; i < 250; i++) q.push("pagina_visivel", null, {});
    const sizes: number[] = [];
    await q.flush(async (b) => {
      sizes.push(b.length);
      return { ok: true };
    });
    expect(sizes).toEqual([100, 100, 50]);
  });

  it("conteúdo é só o previsto para o tipo (sem texto livre)", () => {
    const q = new EventQueue("s", fixedNow);
    const e = q.push("alternativa_marcada", "i", { alternativa: "A" });
    expect(e.payload).toEqual({ alternativa: "A" });
    expect(() => new EventQueue("prefixo com espaço")).toThrow();
  });
});
