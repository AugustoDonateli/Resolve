/** Caminho da redação e nome de cada folha: contas puras para a tela de Redação. */

export interface EssayLike {
  id: string;
  promptTitle: string | null;
  status: "rascunho" | "submetida";
  preview: string;
}

/**
 * Nome de uma redação na lista: o tema, quando há; senão, o começo do texto; senão, "Folha em branco".
 * Evita três linhas iguais de "Tema livre".
 */
export function essayName(e: Pick<EssayLike, "promptTitle" | "preview">): string {
  if (e.promptTitle) return e.promptTitle;
  const text = e.preview.replace(/\s+/g, " ").trim();
  if (!text) return "Folha em branco";
  const cut = text.length > 46 ? `${text.slice(0, 46).replace(/\s+\S*$/, "")}…` : text;
  return `Tema livre: “${cut}”`;
}

export const ESSAY_STEPS = [
  { key: "tema", label: "Escolher o tema", hint: "Uma proposta com textos motivadores, ou tema livre." },
  { key: "escrever", label: "Escrever", hint: "Na folha de 30 linhas. O rascunho se salva sozinho." },
  { key: "enviar", label: "Enviar", hint: "Com pelo menos 50 palavras, a redação vai para a correção." },
  { key: "correcao", label: "Ler a correção", hint: "Nota e comentário por competência, quando a correção estiver disponível." },
  { key: "reescrever", label: "Reescrever", hint: "Uma versão nova a partir da correção, para comparar." },
] as const;
export type EssayStepKey = (typeof ESSAY_STEPS)[number]["key"];

/**
 * Em que passo a pessoa está, pela redação mais recente (fora o treino por peças): sem redação, escolher o
 * tema; com rascunho, escrever; com redação enviada, ler a correção. Devolve também para onde o passo leva.
 */
export function currentEssayStep(latest: EssayLike | undefined): { step: EssayStepKey; href: string; action: string } {
  if (!latest) return { step: "tema", href: "/redacao/temas", action: "Ver os temas" };
  if (latest.status === "rascunho") return { step: "escrever", href: `/redacao/escrever/${latest.id}`, action: "Continuar o rascunho" };
  return { step: "correcao", href: `/redacao/correcao/${latest.id}`, action: "Abrir a correção" };
}
