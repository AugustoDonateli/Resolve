/** Contas puras do clube, testáveis sem banco. */

/** 1.5 → "US$ 1,50". */
export function usd(n: number): string {
  return `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Situação da cota de IA do mês: quanto foi usado (consumido + reservado) e se passou do aviso ou do teto. */
export function quotaState(q: { limitUsd: number; warnRatio: number; consumedUsd: number; reservedUsd: number }): {
  used: number;
  share: number;
  level: "ok" | "aviso" | "esgotada";
} {
  const used = q.consumedUsd + q.reservedUsd;
  const share = q.limitUsd > 0 ? Math.min(1, used / q.limitUsd) : 1;
  return { used, share, level: share >= 1 ? "esgotada" : share >= q.warnRatio ? "aviso" : "ok" };
}

/** Link do convite a partir da origem do site. */
export function inviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/convite/${code}`;
}

/** Código digitado à mão: só letras e números, em maiúsculas. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const INVITE_STATE_LABEL: Record<string, string> = {
  ok: "aberto",
  usado: "usado",
  expirado: "vencido",
  invalido: "cancelado",
  cheio: "grupo completo",
};

/** Confirmação de exclusão: a pessoa digita EXCLUIR (sem diferença de maiúsculas e espaços nas pontas). */
export function confirmsDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === "EXCLUIR";
}
