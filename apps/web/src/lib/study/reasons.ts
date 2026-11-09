/**
 * Motivos de erro (taxonomia v0, decisão 0006). Opcional, um clique; "não informado" é o padrão
 * explícito. A lista é a mesma de private.error_reason_ok no banco (teste confere).
 */
export const ERROR_REASONS = [
  { code: "not_reported", label: "Não informado" },
  { code: "leitura_do_comando", label: "Li errado o que o comando pedia" },
  { code: "interpretacao", label: "Interpretei errado o texto, gráfico ou tabela" },
  { code: "conteudo", label: "Não sabia o conteúdo" },
  { code: "calculo", label: "Errei a conta" },
  { code: "distrator", label: "Caí numa alternativa atraente" },
  { code: "tempo", label: "Faltou tempo ou fui com pressa" },
  { code: "chute", label: "Chutei" },
] as const;

export type ErrorReason = (typeof ERROR_REASONS)[number]["code"];

export const isErrorReason = (v: string): v is ErrorReason => ERROR_REASONS.some((r) => r.code === v);
