/**
 * Formato de uma lição (plano v2, 2A.2): pergunta de entrada, explicação curta, exemplo resolvido com uma
 * questão real, exemplo com lacunas, questões sozinho, pegadinhas com dados do Inep e cartões de resumo.
 * As questões reais são citadas pelo código "ano-posição" do caderno azul.
 */

export type QuestionCode = `${number}-${number}`;
export type Letter = "A" | "B" | "C" | "D" | "E";

export interface EntryOption {
  text: string;
  correct?: boolean;
  /** O que dizer a quem escolhe esta opção. */
  feedback: string;
}

export type Gap =
  | { kind: "numero"; label: string; answer: number; tolerance: number; hint: string; explain: string }
  | { kind: "escolha"; label: string; choices: string[]; correctIndex: number; explain: string };

export interface Trap {
  q: QuestionCode;
  /** Alternativa errada que atraiu muita gente (letra do caderno azul). */
  key: Letter;
  /** Porcentagem de quem marcou essa alternativa, nos microdados do Inep (uma casa decimal). */
  share: number;
  edition: 2024 | 2025;
  title: string;
  text: string[];
}

/** Gráfico de exemplo desenhado em código (dados didáticos, identificados como exemplo na tela). */
export interface StepChart {
  title: string;
  /** Unidade do eixo vertical. */
  unit: string;
  categories: string[];
  series: { name: string; values: number[] }[];
  max: number;
  tick: number;
}
export type ChartTarget = "titulo" | "eixo" | "legenda" | { category: number; series: number };

export interface GrifoCommand {
  /** O comando em palavras; `core` deve ser grifada, `ok` pode ou não. */
  words: { t: string; core?: true; ok?: true }[];
  why: string;
}

/**
 * Recurso da explicação (2A.3): no máximo um por lição, e só com a dificuldade que ele resolve escrita
 * em uma linha (`difficulty`). Fica depois do parágrafo `after` (índice a partir de 0).
 */
export type LessonResource = { after: number; difficulty: string; intro: string } & (
  | { kind: "controle-porcentagem"; base: number }
  | { kind: "grafico-em-etapas"; chart: StepChart; steps: { label: string; target: ChartTarget; text: string }[] }
  | { kind: "grifo"; commands: GrifoCommand[] }
);

export interface Lesson {
  slug: string;
  title: string;
  area: "LC" | "CH" | "CN" | "MT";
  /** Assunto da árvore (código), para o treino e o banco. */
  subjectCode: string;
  minutes: number;
  status: "piloto";
  /** Em uma frase: o que é e por que cai. */
  oneLine: string;
  /** Pergunta de entrada: não é do Enem e não vale nota. */
  entry: { prompt: string; options: EntryOption[] };
  explanation: string[];
  resource?: LessonResource;
  /** Mais um exemplo, mostrado a quem errou a pergunta de entrada. */
  extraExample: string;
  worked: { q: QuestionCode; correct: Letter; intro: string; steps: string[]; afterNote: string };
  gapped: { q: QuestionCode; correct: Letter; intro: string; gaps: Gap[]; conclusion: string };
  practice: { qs: QuestionCode[]; note: string };
  traps: Trap[];
  cards: { front: string; back: string }[];
}
