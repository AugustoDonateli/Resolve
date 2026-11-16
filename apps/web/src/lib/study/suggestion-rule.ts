import { AREA_NAME, type TrainingFocus } from "@/lib/routine/planner";

/** O que fazer agora em Estudar: uma sugestão só, sempre com o motivo à vista. */
export interface Suggestion {
  kind: "revisar" | "area" | "livre";
  title: string;
  /** O porquê, em uma ou duas frases, com os números que levaram à sugestão. */
  reason: string;
  href: string;
  action: string;
}

/**
 * Regra da plataforma (`sugestao-v1`), nesta ordem: fichas vencidas hoje; a área que o plano adaptativo
 * escolheria (mais erro recente ou mais tempo sem treino); sem histórico, um treino livre curto.
 */
export function pickSuggestion(input: { reviewDue: number | null; focus: TrainingFocus | null }): Suggestion {
  const due = input.reviewDue ?? 0;
  if (due > 0)
    return {
      kind: "revisar",
      title: `Revisar ${due} ${due === 1 ? "ficha" : "fichas"}`,
      reason: `${due === 1 ? "Ela vence" : "Elas vencem"} hoje. Uma ficha atrasada recomeça do primeiro intervalo quando você erra; em dia, ela avança.`,
      href: "/revisar",
      action: "Abrir a revisão",
    };
  if (input.focus)
    return {
      kind: "area",
      title: `Treinar ${AREA_NAME[input.focus.area] ?? input.focus.area}`,
      reason: input.focus.reason,
      href: `/estudar?area=${input.focus.area}#treino`,
      action: "Escolher esta área no treino",
    };
  return {
    kind: "livre",
    title: "Um treino livre de 10 questões",
    reason: "Ainda não há respostas suas para comparar as áreas. Dez questões já dão o primeiro retrato.",
    href: "#treino",
    action: "Ir para o treino livre",
  };
}
