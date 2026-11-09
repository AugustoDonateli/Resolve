/**
 * QUESTÃO DEMONSTRATIVA — escrita para o protótipo (F1-T05/F1-T18).
 * NÃO é item do ENEM, não tem fonte oficial e nunca entra no banco principal
 * nem na TRI. Serve apenas para testar componentes e coreografias enquanto o
 * pacote de provas (EXT-PDF) não está disponível.
 */
import type { Letter } from "@/components/ui/alternatives";

export interface Segment {
  text: string;
  /** Âncora de evidência/comando ligada a uma anotação. */
  anchor?: string;
}

export interface DemoAlternative {
  key: string;
  letter: Letter;
  text: string;
  correct?: boolean;
  /** Tipo primário de distrator (taxonomia do plano §4.1). */
  distractor?: string;
  rationale: string;
  anchor?: string;
}

export interface DemoNote {
  id: string;
  step: "comando" | "evidencia" | "distratores";
  anchor: string;
  color: "yellow" | "pink";
  title: string;
  body: string;
}

export const demoQuestion = {
  id: "demo-q1",
  area: "Linguagens",
  source: "Texto e questão demonstrativos escritos para este protótipo · sem fonte oficial",
  title: "A lentidão que ensina",
  paragraphs: [
    [
      {
        text: "Quem já tentou acompanhar uma aula escrevendo à mão conhece a sensação: a caneta é mais lenta que a fala. Enquanto o professor avança, a mão ainda está na frase anterior. Parece uma desvantagem, e muitos estudantes trocam o caderno pelo teclado justamente para não perder nada.",
      },
    ],
    [
      { text: "Mas a lentidão tem um efeito curioso. " },
      {
        text: "Como não consegue copiar tudo, quem anota à mão precisa decidir, a cada minuto, o que merece ficar no papel. Essa escolha obriga a entender antes de registrar: é preciso resumir, trocar palavras, ligar uma ideia à outra.",
        anchor: "ev-b",
      },
      { text: " " },
      {
        text: "O teclado, por ser rápido, permite transcrever a fala quase inteira",
        anchor: "ev-c",
      },
      { text: " — e, com isso, adiar o trabalho de compreender." },
    ],
    [
      { text: "Não se trata de condenar o computador " },
      { text: "nem de prometer milagres ao caderno", anchor: "ev-a" },
      { text: ". Anotar à mão não dispensa a revisão, e " },
      { text: "uma página bem escrita não substitui a leitura do material indicado", anchor: "ev-e" },
      {
        text: ". O ganho está no esforço de seleção: a anotação vira um pequeno exercício de síntese feito no momento em que a aula acontece.",
      },
    ],
  ] satisfies Segment[][],
  command: [
    { text: "No texto, a autora sustenta que " },
    { text: "anotar à mão favorece a aprendizagem porque", anchor: "cmd" },
  ] satisfies Segment[],
  alternatives: [
    {
      key: "a",
      letter: "A",
      text: "garante melhores resultados a qualquer estudante, em qualquer disciplina.",
      distractor: "Generalização",
      rationale: "Amplia a tese para todos os casos. A autora recusa promessas: “nem de prometer milagres ao caderno”.",
      anchor: "ev-a",
    },
    {
      key: "b",
      letter: "B",
      text: "obriga quem anota a selecionar e reformular as ideias enquanto a aula acontece.",
      correct: true,
      rationale: "Resume a causa apontada no segundo parágrafo: decidir o que registrar exige resumir e trocar palavras.",
      anchor: "ev-b",
    },
    {
      key: "c",
      letter: "C",
      text: "permite registrar quase integralmente o que é dito em aula.",
      distractor: "Isca de palavra",
      rationale: "Reaproveita a ideia de transcrever “quase inteira”, mas o texto atribui essa característica ao teclado.",
      anchor: "ev-c",
    },
    {
      key: "d",
      letter: "D",
      text: "depende apenas de a escrita ser mais lenta do que a fala.",
      distractor: "Redução",
      rationale: "Fica só com a lentidão. Para a autora, o ganho vem do esforço de seleção que a lentidão provoca.",
      anchor: "ev-b",
    },
    {
      key: "e",
      letter: "E",
      text: "torna dispensável a leitura do material indicado pela escola.",
      distractor: "Contradição",
      rationale: "O terceiro parágrafo afirma o oposto: a página bem escrita não substitui essa leitura.",
      anchor: "ev-e",
    },
  ] satisfies DemoAlternative[],
  notes: [
    {
      id: "n-cmd",
      step: "comando",
      anchor: "cmd",
      color: "yellow",
      title: "O que o comando pede",
      body: "A causa que a autora apresenta, e não uma opinião geral sobre cadernos. Procure no texto um “porque”.",
    },
    {
      id: "n-ev",
      step: "evidencia",
      anchor: "ev-b",
      color: "yellow",
      title: "Evidência da resposta",
      body: "A lentidão obriga a escolher o que registrar; escolher exige entender, resumir e reformular. É isso que B diz.",
    },
    {
      id: "n-e",
      step: "distratores",
      anchor: "ev-e",
      color: "pink",
      title: "Contradição (E)",
      body: "O texto diz que a anotação não substitui a leitura do material.",
    },
    {
      id: "n-c",
      step: "distratores",
      anchor: "ev-c",
      color: "pink",
      title: "Isca de palavra (C)",
      body: "Transcrever quase tudo é o que o teclado faz, segundo a autora.",
    },
  ] satisfies DemoNote[],
};

export const RAIOX_STEPS = [
  { id: "comando", label: "Comando" },
  { id: "evidencia", label: "Evidência" },
  { id: "distratores", label: "Distratores" },
  { id: "brasil", label: "Brasil" },
] as const;

export type RaioXStep = (typeof RAIOX_STEPS)[number]["id"];
