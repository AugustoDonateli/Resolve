/**
 * Confirmação de resposta com reenvio seguro (F3-T01): o identificador da ação é criado uma vez,
 * antes da primeira tentativa, e reutilizado em todo reenvio. O banco devolve a mesma tentativa
 * para o mesmo identificador; erros definitivos (já respondida, sessão encerrada, prazo) não são reenviados.
 */
export const FINAL_ERRORS = [
  "resolve_already_answered",
  "resolve_action_reused",
  "resolve_session_closed",
  "resolve_session_paused",
  "resolve_deadline_passed",
  "resolve_alternative_invalid",
  "resolve_item_unavailable",
  "resolve_session_item_not_found",
  "resolve_time_invalid",
  "resolve_card_not_in_review",
  "resolve_card_unavailable",
  "resolve_already_decided",
  "resolve_triage_decision_invalid",
] as const;

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string; final: boolean };

export async function withSameAction<T>(
  actionId: string,
  call: (actionId: string) => Promise<Outcome<T>>,
  { attempts = 4, delays = [500, 1500, 4000], sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<Outcome<T>> {
  let last: Outcome<T> = { ok: false, error: "sem tentativa", final: false };
  for (let i = 0; i < attempts; i++) {
    last = await call(actionId);
    if (last.ok || last.final) return last;
    if (i < attempts - 1) await sleep(delays[Math.min(i, delays.length - 1)] ?? 1000);
  }
  return last;
}

export function classify(message: string): { error: string; final: boolean } {
  const code = FINAL_ERRORS.find((c) => message.includes(c));
  return code ? { error: code, final: true } : { error: message, final: false };
}
