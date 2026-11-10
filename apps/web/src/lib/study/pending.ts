/**
 * Respostas pendentes (F3-T03): quando a confirmação não chega ao servidor (queda de rede, aba fechada),
 * a resposta fica guardada no aparelho com o MESMO identificador de ação. Ao reabrir ou quando a conexão
 * volta, o envio é repetido; o banco devolve a mesma tentativa para o mesmo identificador, então nada
 * se perde nem duplica. A fila só é limpa depois de resposta definitiva (sucesso ou erro final).
 */
export interface PendingAnswer {
  sessionId: string;
  sessionItemId: string;
  actionId: string;
  alternativeKey: string;
  alternativeId: string;
  activeMs: number;
  savedAt: string;
}

export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const KEY = "resolve:respostas-pendentes";

function read(store: KeyValue): PendingAnswer[] {
  try {
    const raw = store.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? (list as PendingAnswer[]).filter(
          (p) => p && typeof p.actionId === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function write(store: KeyValue, list: PendingAnswer[]) {
  try {
    if (list.length) store.setItem(KEY, JSON.stringify(list));
    else store.removeItem(KEY);
  } catch {
    // armazenamento indisponível (aba privada): segue só com o reenvio imediato
  }
}

/** Guarda (ou substitui) a pendência de uma questão. Uma por questão da sessão. */
export function savePending(store: KeyValue, p: PendingAnswer): void {
  write(store, [
    ...read(store).filter((x) => x.sessionItemId !== p.sessionItemId),
    p,
  ]);
}

export function pendingFor(
  store: KeyValue,
  sessionId: string,
): PendingAnswer[] {
  return read(store).filter((p) => p.sessionId === sessionId);
}

export function clearPending(store: KeyValue, sessionItemId: string): void {
  write(
    store,
    read(store).filter((p) => p.sessionItemId !== sessionItemId),
  );
}

export type SendResult = { ok: true } | { ok: false; final: boolean };

/**
 * Reenvia as pendências da sessão, em ordem. Sucesso ou erro definitivo limpam a pendência; erro de
 * rede a mantém para a próxima tentativa. Devolve as questões resolvidas nesta rodada.
 */
export async function flushPending(
  store: KeyValue,
  sessionId: string,
  send: (p: PendingAnswer) => Promise<SendResult>,
): Promise<{ sent: string[]; failedFinal: string[]; kept: string[] }> {
  const out = {
    sent: [] as string[],
    failedFinal: [] as string[],
    kept: [] as string[],
  };
  for (const p of pendingFor(store, sessionId)) {
    const r = await send(p);
    if (r.ok) {
      clearPending(store, p.sessionItemId);
      out.sent.push(p.sessionItemId);
    } else if (r.final) {
      clearPending(store, p.sessionItemId);
      out.failedFinal.push(p.sessionItemId);
    } else {
      out.kept.push(p.sessionItemId);
    }
  }
  return out;
}
