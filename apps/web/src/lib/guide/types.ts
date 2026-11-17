import { z } from "zod";

/** Guia de primeiros passos (sessão 3 do plano v2): o que a conta já viu e os textos de cada parte. */

export const GUIDE_KEYS = ["ficha", "primeira_questao", "tour", "dica_triagem", "dica_ritmo", "dica_dia_d", "dica_duelo"] as const;
export type GuideKey = (typeof GUIDE_KEYS)[number];
export type GuideState = Record<GuideKey, boolean>;

/** `profiles.guide` (chave → quando foi visto) → o que já foi visto. Qualquer coisa fora do formato conta como não visto. */
export function parseGuide(raw: unknown): GuideState {
  const seen = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(GUIDE_KEYS.map((k) => [k, typeof seen[k] === "string" && seen[k] !== ""])) as GuideState;
}

/** Os três primeiros passos, na ordem; null quando todos já foram feitos ou pulados. */
export const FIRST_STEPS = ["ficha", "primeira_questao", "tour"] as const;
export type FirstStep = (typeof FIRST_STEPS)[number];
export function currentStep(g: Pick<GuideState, FirstStep>): FirstStep | null {
  return FIRST_STEPS.find((k) => !g[k]) ?? null;
}

/**
 * Estimativa para o 1º dia do Enem 2027, usada só para preencher o campo: o edital ainda não saiu.
 * A prova costuma cair em dois domingos de novembro; 7/11/2027 é o primeiro domingo do mês.
 */
export const EXAM_DAY_GUESS = "2027-11-07";

export const HOURS_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 40] as const;

export interface FichaValues {
  course: string;
  institution: string;
  weeklyHours: number | null;
  language: "ingles" | "espanhol" | null;
  examDay: string | null;
}

export interface FichaDefaults extends FichaValues {
  /** Já existe meta de curso ativa: curso e instituição aparecem só para leitura (mudam em Meta de curso). */
  goalLocked: boolean;
  /** A data veio da conta (true) ou é a estimativa de preenchimento (false). */
  examDayFromAccount: boolean;
}

export const fichaSchema = z
  .object({
    course: z.string().trim().max(120),
    institution: z.string().trim().max(160),
    weeklyHours: z.number().int().min(1).max(80).nullable(),
    language: z.enum(["ingles", "espanhol"]).nullable(),
    examDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .refine((v) => (v.course.length === 0 && v.institution.length === 0) || (v.course.length >= 2 && v.institution.length >= 2), {
    message: "Para guardar o curso, preencha o curso e onde. Se ainda não decidiu, deixe os dois em branco.",
  });

export type TipKey = Extract<GuideKey, `dica_${string}`>;

/** Dicas da primeira vez: o que é, quando usar e quanto tempo leva. As mesmas ficam em "Como funciona". */
export const TIPS: Record<TipKey, { title: string; what: string; when: string; time: string; href: string }> = {
  dica_triagem: {
    title: "Triagem de 20 segundos",
    what: "Você olha cada questão por até 20 segundos e decide: resolver agora, deixar para depois ou chutar. Depois resolve todas e compara com o que decidiu.",
    when: "Quando você gasta tempo demais em questão difícil e falta tempo no fim da prova.",
    time: "De 5 a 20 questões. Com 5, de 15 a 20 minutos.",
    href: "/estudar#triagem",
  },
  dica_ritmo: {
    title: "Blocos de ritmo",
    what: "Um bloco de questões contra o relógio, com alvo de 3 minutos por questão. O gabarito só aparece no fim, como na prova.",
    when: "Quando você acerta com calma, mas ainda não sabe se o tempo dá.",
    time: "Você escolhe: 15, 45, 90 ou 180 minutos.",
    href: "/estudar#ritmo",
  },
  dica_dia_d: {
    title: "Dia D",
    what: "Um caderno oficial inteiro, com o relógio correndo no servidor e o cartão-resposta para preencher. O tempo não para quando você fecha a tela.",
    when: "Para ensaiar a prova de verdade. Vale mais depois de treinar por área.",
    time: "O tempo oficial do dia de prova: 5h30 no 1º dia e 5h no 2º.",
    href: "/estudar/dia-d",
  },
  dica_duelo: {
    title: "Duelo",
    what: "Todos do grupo resolvem as mesmas questões oficiais, cada um no seu tempo. Os acertos dos outros só aparecem quando você termina.",
    when: "Para estudar com colegas sem precisar marcar horário.",
    time: "5 ou 10 questões. O duelo fica aberto por 7 dias.",
    href: "/grupos",
  },
};

/** Paradas do tour da mesa: o alvo é o `data-tour` do objeto em Hoje. Uma frase por objeto. */
export const TOUR: { target: string; title: string; text: string }[] = [
  { target: "plano", title: "Folha de hoje", text: "O que estudar hoje e por quanto tempo. Amanhã, comece por aqui." },
  { target: "agenda", title: "Agenda", text: "Seus horários livres e compromissos. O plano do dia sai desses horários." },
  { target: "caderno", title: "Caderno", text: "As questões oficiais do Enem: treino livre, banco com filtros e simulado completo." },
  { target: "fichas", title: "Fichas", text: "Aqui ficam as suas revisões. Uma questão errada vira ficha e volta amanhã, depois em 3, 7, 14 e 30 dias." },
  { target: "folha", title: "Folha de redação", text: "A folha de 30 linhas da redação: escrever, corrigir e reescrever." },
  { target: "regua", title: "Régua", text: "Mostra o que você já fez: questões respondidas, acertos por habilidade e a meta de curso." },
];
