/**
 * REDAÇÃO E CORREÇÃO DEMONSTRATIVAS — escritas para o protótipo (F1-T06).
 * Não são texto de candidato, não foram avaliadas por IA nem por corretor e
 * as notas não têm valor de referência. O texto evita estatísticas para não
 * criar dados inventados.
 */
import type { Segment } from "./question";

export type CompetencyCode = "C1" | "C2" | "C3" | "C4" | "C5";

export interface EssayAnnotation {
  id: string;
  competency: CompetencyCode;
  anchor: string;
  kind: "ajuste" | "acerto";
  title: string;
  comment: string;
}

export interface ProposalElement {
  key: "agente" | "acao" | "meio" | "finalidade" | "detalhamento";
  label: string;
  /** Ausente: indicado sem fabricar trecho (plano §4.5). */
  anchor: string | null;
}

export const demoEssay = {
  prompt: "Caminhos para reduzir o desperdício de alimentos no Brasil",
  note: "Redação e comentários demonstrativos escritos para o protótipo · sem avaliação real",
  paragraphs: [
    [
      { text: "A Constituição Federal de 1988 inclui a alimentação entre os direitos sociais", anchor: "c2-a" },
      {
        text: " de todos os brasileiros. Na prática, porém, esse direito convive com um hábito contraditório: comida em boas condições vai para o lixo todos os dias, enquanto muitas famílias não sabem se terão a próxima refeição. ",
      },
      { text: "Esse desperdício é sustentado tanto pela falta de informação quanto pela forma como os alimentos são vendidos.", anchor: "c3-a" },
    ],
    [
      { text: "Em primeiro lugar, " },
      { text: "existem muitas famílias que joga fora", anchor: "c1-a" },
      {
        text: " alimentos ainda próprios para o consumo por não saber aproveitá-los. Cascas, talos e sobras costumam ser vistos como lixo, quando poderiam virar outras receitas. ",
      },
      { text: "Isso é muito ruim para todos.", anchor: "c3-b" },
    ],
    [
      { text: "Porém, o problema não está só dentro de casa. Porém,", anchor: "c4-a" },
      {
        text: " mercados e feiras descartam frutas e verduras com pequenas manchas, porque o consumidor aprendeu a escolher pela aparência. Assim, o alimento é perdido antes mesmo de chegar à mesa.",
      },
    ],
    [
      { text: "Portanto, é necessário enfrentar o desperdício. Para isso, " },
      { text: "o Ministério da Educação", anchor: "c5-agente" },
      { text: " " },
      { text: "deve criar campanhas nas escolas", anchor: "c5-acao" },
      { text: ", " },
      { text: "por meio de aulas práticas sobre aproveitamento de alimentos", anchor: "c5-meio" },
      { text: ", " },
      { text: "a fim de reduzir o descarte dentro das casas", anchor: "c5-finalidade" },
      { text: "." },
    ],
  ] satisfies Segment[][],
  competencies: [
    { code: "C1", label: "Norma escrita", score: 120 },
    { code: "C2", label: "Tema e repertório", score: 160 },
    { code: "C3", label: "Argumentação", score: 120 },
    { code: "C4", label: "Coesão", score: 160 },
    { code: "C5", label: "Proposta", score: 160 },
  ] as { code: CompetencyCode; label: string; score: number }[],
  annotations: [
    {
      id: "a-c1",
      competency: "C1",
      anchor: "c1-a",
      kind: "ajuste",
      title: "Concordância verbal",
      comment: "O verbo concorda com “famílias”: “famílias que jogam fora”.",
    },
    {
      id: "a-c2",
      competency: "C2",
      anchor: "c2-a",
      kind: "acerto",
      title: "Repertório pertinente",
      comment: "Referência legitimada e ligada ao tema. Para avançar, retome a Constituição no desenvolvimento, não só na abertura.",
    },
    {
      id: "a-c3a",
      competency: "C3",
      anchor: "c3-a",
      kind: "acerto",
      title: "Tese com dois motivos",
      comment: "Os dois parágrafos seguintes desenvolvem exatamente esses motivos. Bom planejamento.",
    },
    {
      id: "a-c3b",
      competency: "C3",
      anchor: "c3-b",
      kind: "ajuste",
      title: "Afirmação genérica",
      comment: "Diga para quem é ruim e por quê. Qual consequência concreta o descarte doméstico provoca?",
    },
    {
      id: "a-c4",
      competency: "C4",
      anchor: "c4-a",
      kind: "ajuste",
      title: "Conectivo repetido",
      comment: "“Porém” aparece duas vezes seguidas e não há contraste com o parágrafo anterior. “Além disso” indicaria adição.",
    },
    {
      id: "a-c5",
      competency: "C5",
      anchor: "c5-agente",
      kind: "ajuste",
      title: "Quatro de cinco elementos",
      comment: "Agente, ação, meio e finalidade presentes. Falta detalhar um elemento — por exemplo, quem conduziria as aulas ou como seriam feitas.",
    },
  ] satisfies EssayAnnotation[],
  proposal: [
    { key: "agente", label: "Agente", anchor: "c5-agente" },
    { key: "acao", label: "Ação", anchor: "c5-acao" },
    { key: "meio", label: "Meio", anchor: "c5-meio" },
    { key: "finalidade", label: "Finalidade", anchor: "c5-finalidade" },
    { key: "detalhamento", label: "Detalhamento", anchor: null },
  ] satisfies ProposalElement[],
};
