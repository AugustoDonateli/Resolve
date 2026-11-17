import type { Lesson } from "../types";

export const comandoEmLinguagens: Lesson = {
  slug: "comando-em-linguagens",
  title: "O comando em Linguagens",
  area: "LC",
  subjectCode: "LC.1.1",
  minutes: 12,
  status: "piloto",
  oneLine:
    "Em Linguagens, a pergunta vem no fim, depois de um texto longo. Quem lê o comando primeiro sabe o que procurar e cai menos nas alternativas verdadeiras que não respondem.",
  entry: {
    prompt: "Comando: “Nesse texto, a autora tem como objetivo principal...”. O que você deve procurar no texto?",
    options: [
      { text: "A finalidade do texto inteiro", correct: true, feedback: "Isso. “Objetivo principal” pede para que o texto foi escrito, olhando o todo." },
      { text: "Uma informação de um parágrafo específico", feedback: "Um detalhe de um parágrafo raramente é o objetivo principal do texto." },
      { text: "A opinião do leitor sobre o tema", feedback: "O comando fala da autora, não do leitor." },
      { text: "O significado de uma palavra difícil", feedback: "O comando não pergunta sobre vocabulário. Ele pede a finalidade do texto." },
    ],
  },
  explanation: [
    "Nas questões de Linguagens, o texto vem primeiro e o comando vem no fim. Leia o comando antes do texto. Assim você lê o texto já sabendo o que procurar.",
    "Todo comando tem um núcleo: o que você precisa encontrar. Pode ser a finalidade do texto, o efeito de um recurso, a função de um trecho, uma característica do gênero ou o que o texto afirma sobre um ponto.",
    "Sublinhe o núcleo. Em “o aspecto tecnológico que influencia a composição do gênero crônica advém da”, o núcleo é “aspecto tecnológico”. Não é qualquer característica da crônica: é a que vem da tecnologia.",
    "Muitas alternativas erradas dizem algo verdadeiro sobre o texto, mas respondem a outra pergunta. Antes de marcar, confira se a alternativa responde ao núcleo do comando.",
    "Depois de escolher, volte ao texto e ache o trecho que sustenta a alternativa. Se não achar, desconfie da escolha.",
  ],
  extraExample:
    "Mais um exemplo. Em “O uso das aspas no segundo parágrafo produz o efeito de...”, o núcleo é o efeito das aspas. A resposta fala do que as aspas fazem naquele trecho, e não do texto inteiro.",
  worked: {
    q: "2025-32",
    correct: "E",
    intro: "Uma questão de 2025 em que só 11,8% acertaram. A maioria marcou uma alternativa verdadeira que não respondia ao comando.",
    steps: [
      "Comando primeiro: “o aspecto tecnológico que influencia a composição do gênero crônica advém da”. O núcleo é “aspecto tecnológico”.",
      "Tecnologia, aqui, é o suporte em que a crônica é publicada: o jornal impresso, com páginas de tamanho fixo.",
      "No texto: “Ocorre ainda o limite de espaço, uma vez que a página comporta várias matérias”. O espaço curto obriga o cronista a escrever de modo econômico.",
      "A alternativa que fala do suporte é a E: restrição espacial do suporte.",
    ],
    afterNote:
      "A alternativa C, ênfase no público leitor, foi marcada por 39,0%. O texto fala mesmo do público, mas público não é aspecto tecnológico.",
  },
  gapped: {
    q: "2025-8",
    correct: "D",
    intro: "Agora você faz os dois passos nesta questão de 2025, sobre a crônica “De próprio punho”.",
    gaps: [
      {
        kind: "escolha",
        label: "Qual é o núcleo do comando?",
        choices: [
          "O que caracteriza a escrita de próprio punho",
          "O que ilustra a escrita digital no texto",
          "As tecnologias que a autora usa para escrever",
        ],
        correctIndex: 1,
        explain: "O comando já diz que a escrita de próprio punho é a letra manuscrita. O que ele pede é o que ilustra a escrita digital.",
      },
      {
        kind: "escolha",
        label: "Que trecho do texto ilustra a escrita digital?",
        choices: [
          "Linhas 10 e 11: Muita gente sente o mesmo que eu",
          "Linhas 18 e 19: No lugar, aparecem Times New Roman, Arial, Calibri e mais uma centena de “letras” à minha escolha",
          "Linhas 25 e 26: Eles estão principalmente na cozinha, em especial na porta da geladeira",
        ],
        correctIndex: 1,
        explain: "No teclado, a letra da autora dá lugar às fontes do computador.",
      },
    ],
    conclusion: "Esse trecho leva à alternativa D: a diversidade de fontes tipográficas disponíveis.",
  },
  practice: {
    qs: ["2024-41", "2025-6", "2025-7"],
    note: "Três questões reais de Linguagens. Leia o comando antes do texto e sublinhe o núcleo. O Raio-X vem depois de cada resposta.",
  },
  traps: [
    {
      q: "2025-32",
      key: "C",
      share: 39.0,
      edition: 2025,
      title: "Verdadeira, mas responde a outra pergunta",
      text: ["O texto fala do público leitor da crônica. Só que o comando pede o aspecto tecnológico. Ênfase no público leitor, a alternativa C, foi a mais marcada."],
    },
    {
      q: "2025-8",
      key: "A",
      share: 28.4,
      edition: 2025,
      title: "Vale para o texto todo, não para o ponto pedido",
      text: [
        "Utilização de tecnologias diversificadas é verdade para a crônica inteira. Mas o comando pede o que ilustra a escrita digital. A alternativa A não ilustra nada específico.",
      ],
    },
    {
      q: "2025-43",
      key: "E",
      share: 22.3,
      edition: 2025,
      title: "Um fato do texto que não é o destaque",
      text: [
        "Na questão 43 de 2025, a reportagem cita o reconhecimento da comunidade pela Funai. Mas o que ela destaca, do primeiro ao último parágrafo, é uma mulher na liderança do povo.",
        "A alternativa E troca o destaque por um detalhe. A certa é a D, protagonismo feminino na linha sucessória.",
      ],
    },
  ],
  cards: [
    { front: "O que fazer antes de ler o texto em Linguagens?", back: "Ler o comando e sublinhar o núcleo: o que você precisa encontrar." },
    { front: "O que é o núcleo do comando?", back: "O que a questão pede: finalidade, efeito, função, característica do gênero ou o que o texto afirma sobre um ponto." },
    { front: "Alternativa verdadeira sobre o texto é sempre a certa?", back: "Não. Ela também precisa responder ao núcleo do comando." },
    { front: "Como conferir a escolha?", back: "Achar no texto o trecho que sustenta a alternativa. Sem trecho, desconfie." },
  ],
};
