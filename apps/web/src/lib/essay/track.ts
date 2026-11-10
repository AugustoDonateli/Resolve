/**
 * Trilha "Redação do zero": sequência didática da plataforma (não é material do Inep). Cada etapa liga
 * uma competência da matriz oficial (o texto do nível vem da rubrica no banco) a um exercício que já
 * existe no Resolve.
 */
export interface TrackStep {
  id: string;
  title: string;
  competency: "C1" | "C2" | "C3" | "C4" | "C5" | null;
  why: string;
  how: string[];
  action: { label: string; href: string };
}

export const TRACK: TrackStep[] = [
  {
    id: "proposta",
    title: "Ler a proposta e achar o recorte",
    competency: "C2",
    why: "O tema tem um recorte: escrever sobre o assunto geral, sem o recorte, é tangenciar.",
    how: [
      "Sublinhe no tema as palavras que limitam o assunto (quem, onde, qual problema).",
      "Leia os textos motivadores procurando dados e pontos de vista, não frases para copiar.",
      "Escreva em uma linha qual problema você vai discutir.",
    ],
    action: { label: "Abrir um tema", href: "/redacao/temas" },
  },
  {
    id: "tese",
    title: "Tese: posição e dois motivos",
    competency: "C2",
    why: "A tese diz o que você defende e anuncia os argumentos; o resto do texto existe para sustentá-la.",
    how: [
      "Uma frase com a sua posição sobre o problema do recorte.",
      "Dois motivos que você consegue desenvolver, um por parágrafo.",
      "Evite tese genérica que caberia em qualquer tema.",
    ],
    action: { label: "Treinar uma introdução", href: "/redacao/pecas" },
  },
  {
    id: "repertorio",
    title: "Repertório que faz trabalho",
    competency: "C2",
    why: "Repertório conta quando é pertinente ao tema e é usado para argumentar, não só citado.",
    how: [
      "Para cada eixo que você estuda, guarde um dado, uma lei ou uma obra com a fonte.",
      "Anote como o repertório ajuda: que ideia ele comprova ou ilustra.",
      "Prefira repertório que você sabe explicar com as próprias palavras.",
    ],
    action: { label: "Abrir o repertório", href: "/redacao/repertorio" },
  },
  {
    id: "desenvolvimento",
    title: "Parágrafo de desenvolvimento",
    competency: "C3",
    why: "Cada parágrafo defende uma ideia: afirmação, explicação, prova e fechamento ligado à tese.",
    how: [
      "Tópico frasal: a ideia do parágrafo em uma frase.",
      "Explique por que ela é verdadeira e traga o repertório como prova.",
      "Feche mostrando como isso sustenta a tese.",
    ],
    action: { label: "Treinar um desenvolvimento", href: "/redacao/pecas" },
  },
  {
    id: "coesao",
    title: "Coesão entre as partes",
    competency: "C4",
    why: "Conectivos mostram a relação entre as ideias (causa, oposição, conclusão) e evitam repetição.",
    how: [
      "Comece cada parágrafo com um elemento que o ligue ao anterior.",
      "Varie conectivos e retomadas (pronomes, sinônimos) sem trocar o sentido.",
      "Releia procurando frases soltas, sem relação marcada.",
    ],
    action: { label: "Revisar um desenvolvimento", href: "/redacao/pecas" },
  },
  {
    id: "intervencao",
    title: "Conclusão com proposta de intervenção",
    competency: "C5",
    why: "A proposta resolve o problema discutido e respeita os direitos humanos; quanto mais completa e articulada, melhor.",
    how: [
      "Agente: quem faz.",
      "Ação: o que faz.",
      "Meio ou modo: como faz.",
      "Finalidade: para quê.",
      "Detalhamento: um elemento a mais que explique um dos anteriores.",
    ],
    action: { label: "Treinar a intervenção", href: "/redacao/pecas" },
  },
  {
    id: "norma",
    title: "Revisão da norma escrita",
    competency: "C1",
    why: "Desvios de concordância, regência, pontuação e grafia descontam; a revisão final pega boa parte deles.",
    how: [
      "Leia uma vez só procurando concordância verbal e nominal.",
      "Leia outra procurando pontuação em frases longas.",
      "Troque palavras informais por equivalentes do registro formal.",
    ],
    action: { label: "Abrir minhas redações", href: "/redacao/minhas" },
  },
  {
    id: "completa",
    title: "Redação completa na folha",
    competency: null,
    why: "Junte as partes em até 30 linhas e envie para a correção por competência.",
    how: [
      "Planeje em 5 minutos: recorte, tese, dois argumentos, intervenção.",
      "Escreva na folha simulada e confira a contagem de linhas.",
      "Envie para correção e reescreva a partir dos comentários.",
    ],
    action: { label: "Escrever uma redação", href: "/redacao/minhas" },
  },
];
