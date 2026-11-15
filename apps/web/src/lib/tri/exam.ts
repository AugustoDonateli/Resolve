import { eap, type ItemParameters, type ModelConfig } from "./engine";

export interface ExamAreaInput {
  area: string;
  label: string;
  /** Itens válidos (não anulados) da área na prova, com o que ficou no cartão. */
  items: { itemId: string; correct: boolean; blank: boolean }[];
}

export interface ExamAreaScore {
  area: string;
  label: string;
  status: "ok" | "sem_modelo" | "em_branco";
  score: number | null;
  lower: number | null;
  upper: number | null;
  correct: number;
  total: number;
  nUsed: number;
  excluded: number;
  modelId: string | null;
  validated: boolean;
}

/**
 * Nota de uma prova completa por área, com o modelo registrado da área. Segue as regras do Inep que o cálculo
 * reproduz: em branco conta como erro; item abandonado pelo Inep fica fora; quem deixa a área inteira em
 * branco recebe 0 (regra da prova, por isso não passa pelo modelo).
 */
export function scoreExam(
  areas: ExamAreaInput[],
  models: Map<string, { id: string; status: string; config: ModelConfig }>,
  params: Map<string, ItemParameters | null>,
): ExamAreaScore[] {
  return areas.map((a) => {
    const model = models.get(a.area);
    const base = {
      area: a.area,
      label: a.label,
      correct: a.items.filter((i) => i.correct).length,
      total: a.items.length,
      modelId: model?.id ?? null,
      validated: model?.status === "validado",
    };
    if (!model || !model.config.transform) {
      return { ...base, status: "sem_modelo", score: null, lower: null, upper: null, nUsed: 0, excluded: 0 };
    }
    if (a.items.length > 0 && a.items.every((i) => i.blank)) {
      return { ...base, status: "em_branco", score: 0, lower: null, upper: null, nUsed: 0, excluded: 0 };
    }
    const e = eap(a.items.map((i) => ({ itemId: i.itemId, correct: i.correct })), params, model.config);
    return { ...base, status: "ok", score: e.score, lower: e.lower, upper: e.upper, nUsed: e.nUsed, excluded: e.excluded.length };
  });
}
