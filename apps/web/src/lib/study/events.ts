/**
 * Eventos de sessão (F3-T12). Só eventos discretos, com conteúdo fechado por tipo: nenhum texto
 * digitado, cursor, rolagem ou tecla. Os tipos e formatos são os mesmos que o banco aceita
 * (private.event_payload_ok); os gerados pelo servidor (resposta, início, fim, motivo) não passam por aqui.
 */
export const CLIENT_EVENT_TYPES = [
  "questao_aberta",
  "questao_saida",
  "alternativa_marcada",
  "alternativa_desmarcada",
  "ajuda_vista",
  "marcada_para_revisar",
  "desmarcada_para_revisar",
  "pagina_oculta",
  "pagina_visivel",
] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

type Letter = "A" | "B" | "C" | "D" | "E";
export type EventPayload<T extends ClientEventType> = T extends "alternativa_marcada" | "alternativa_desmarcada"
  ? { alternativa: Letter }
  : T extends "questao_aberta"
    ? { origem?: "inicio" | "proxima" | "anterior" | "lista" | "retorno" }
    : Record<string, never>;

export interface QueuedEvent {
  client_event_id: string;
  type: ClientEventType;
  session_item_id: string | null;
  payload: Record<string, string>;
  client_at: string;
}

export type SendEvents = (events: QueuedEvent[]) => Promise<{ ok: boolean }>;

/**
 * Fila local de eventos: cada evento recebe um identificador estável na criação; o envio é em
 * lotes de até 100 e, se falhar, o mesmo lote (mesmos identificadores) é reenviado depois. O banco
 * ignora identificadores repetidos, então reenvio nunca duplica nem troca a ordem.
 */
export class EventQueue {
  private pending: QueuedEvent[] = [];
  private counter = 0;
  private sending = false;

  constructor(
    private readonly prefix: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(prefix)) throw new Error("Prefixo de evento inválido.");
  }

  push<T extends ClientEventType>(type: T, sessionItemId: string | null, payload: EventPayload<T>): QueuedEvent {
    const e: QueuedEvent = {
      client_event_id: `${this.prefix}-${++this.counter}`,
      type,
      session_item_id: sessionItemId,
      payload: { ...(payload as Record<string, string>) },
      client_at: this.now().toISOString(),
    };
    this.pending.push(e);
    return e;
  }

  get size() {
    return this.pending.length;
  }

  /** Envia o que estiver pendente, na ordem. Devolve quantos foram confirmados. */
  async flush(send: SendEvents): Promise<number> {
    if (this.sending || this.pending.length === 0) return 0;
    this.sending = true;
    let sent = 0;
    try {
      while (this.pending.length > 0) {
        const batch = this.pending.slice(0, 100);
        const r = await send(batch).catch(() => ({ ok: false }));
        if (!r.ok) break; // fica na fila com os mesmos identificadores
        this.pending.splice(0, batch.length);
        sent += batch.length;
      }
    } finally {
      this.sending = false;
    }
    return sent;
  }
}
