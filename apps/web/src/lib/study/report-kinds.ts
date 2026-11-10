/** Tipos de problema que o aluno pode relatar (F3-T17); a mesma lista do CHECK de item_reports. */
export const REPORT_KINDS = [
  { code: "texto_diferente_da_prova", label: "Texto diferente da prova" },
  { code: "figura", label: "Figura cortada ou ilegível" },
  { code: "alternativas", label: "Alternativas com problema" },
  { code: "gabarito", label: "Gabarito parece errado" },
  { code: "resolucao", label: "Resolução ou Raio-X com problema" },
  { code: "outro", label: "Outro" },
] as const;
