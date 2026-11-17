import type { Lesson } from "../types";

export const leituraDeGraficos: Lesson = {
  slug: "leitura-de-graficos",
  title: "Leitura de gráficos",
  area: "MT",
  subjectCode: "MT.3.1.1",
  minutes: 12,
  status: "piloto",
  oneLine:
    "Gráficos aparecem nas quatro áreas do Enem. Ler direito é saber o que foi medido, em que unidade e o que o comando quer que você tire dali.",
  entry: {
    prompt: "Uma turma tem 40 alunos. Num gráfico de setores, 25% deles escolheram vôlei. Quantos alunos escolheram vôlei?",
    options: [
      { text: "25", feedback: "25 é a porcentagem, não a quantidade de alunos. 25% de 40 é 10." },
      { text: "10", correct: true, feedback: "Isso. 25% é um quarto, e 40 ÷ 4 = 10." },
      { text: "15", feedback: "15 de 40 é 37,5%. Para 25%, divida 40 por 4." },
      { text: "4", feedback: "4 é 10% de 40. Para 25%, divida 40 por 4." },
    ],
  },
  explanation: [
    "Antes dos números, leia três coisas: o título, os eixos e a legenda. O título diz o que foi medido. O eixo diz a unidade. A legenda diz o que cada cor representa.",
    "Cada tipo de gráfico serve para uma coisa. O de setores mostra partes de um total, quase sempre em porcentagem. O de barras compara quantidades. O de linhas mostra como algo muda ao longo do tempo.",
    "O Enem gosta de dois gráficos lado a lado ou de duas linhas no mesmo gráfico. Nesses casos, confira de qual gráfico, de qual ano ou de qual linha vem cada número que você usa.",
    "Quando o valor fica entre duas linhas da grade, estime pelo meio do intervalo. Se a conta precisar de um número exato, procure o valor escrito no próprio gráfico.",
    "Por fim, volte ao comando. Ele pode pedir um valor, uma comparação, uma diferença ou uma ordem. A alternativa certa responde exatamente ao que foi pedido.",
  ],
  resource: {
    kind: "grafico-em-etapas",
    after: 0,
    difficulty: "Quem começa pelos números lê a barra errada; as etapas treinam a ordem título, eixo, legenda.",
    intro: "Um gráfico de exemplo, com números inventados, para treinar a ordem da leitura. Avance uma etapa por vez.",
    chart: {
      title: "Esporte preferido dos alunos de duas turmas",
      unit: "Número de alunos",
      categories: ["Futebol", "Vôlei", "Basquete", "Natação"],
      series: [
        { name: "Turma da manhã", values: [14, 9, 5, 8] },
        { name: "Turma da tarde", values: [10, 12, 4, 6] },
      ],
      max: 16,
      tick: 4,
    },
    steps: [
      { label: "Título", target: "titulo", text: "O título diz o que foi medido: o esporte preferido dos alunos de duas turmas. Ainda não olhe os números." },
      { label: "Eixo", target: "eixo", text: "O eixo vertical diz a unidade: número de alunos. Cada linha da grade vale 4 alunos." },
      { label: "Legenda", target: "legenda", text: "A legenda diz qual barra é de qual turma. A barra cheia é a turma da manhã. A listrada é a turma da tarde." },
      {
        label: "O número pedido",
        target: { category: 1, series: 1 },
        text: "Agora o número que o comando pediria: os alunos da tarde que preferem vôlei. Barra listrada, no vôlei: 12 alunos. Quem pulou a legenda costuma responder 9, que é a manhã.",
      },
    ],
  },
  extraExample:
    "Mais um exemplo. Numa pesquisa com 300 pessoas, um gráfico de setores mostra 60% para ônibus. São 300 × 0,60 = 180 pessoas que usam ônibus.",
  worked: {
    q: "2025-147",
    correct: "E",
    intro: "Dois gráficos lado a lado, de anos diferentes. Uma questão de 2025.",
    steps: [
      "O comando pede o número de matrículas em francês em 2025.",
      "Leia os dois títulos. O gráfico de setores é de 2023 e está em porcentagem. O de barras é de 2024 e está em quantidade de matrículas.",
      "A estimativa usa o total de 2024 com a distribuição de 2023. Total de 2024: 280 + 80 + 20 + 20 = 400 matrículas.",
      "Francês tinha 10% em 2023. Então, em 2025, são 10% de 400 = 40 matrículas. Alternativa E.",
    ],
    afterNote:
      "A alternativa C, 20, é o número de francês na barra de 2024. Ela foi marcada por 32,6% de quem fez a prova: é o número do gráfico do ano errado.",
  },
  gapped: {
    q: "2024-152",
    correct: "A",
    intro: "Agora você lê o gráfico desta questão de 2024. Saldo é exportação menos importação, no mesmo mês.",
    gaps: [
      {
        kind: "numero",
        label: "Em junho de 2009, as exportações estão em 14,5 e as importações em 10, em bilhão de dólares. Qual é o saldo S₁?",
        answer: 4.5,
        tolerance: 0.05,
        hint: "Saldo é exportação menos importação: 14,5 − 10.",
        explain: "S₁ = 14,5 − 10 = 4,5 bilhões.",
      },
      {
        kind: "numero",
        label: "Em junho de 2010, o gráfico traz os valores escritos: 17,1 e 14,8. Qual é o saldo S₃?",
        answer: 2.3,
        tolerance: 0.05,
        hint: "17,1 − 14,8.",
        explain: "S₃ = 17,1 − 14,8 = 2,3 bilhões.",
      },
      {
        kind: "escolha",
        label: "Em janeiro de 2010, a linha cinza das importações está acima da linha preta das exportações. O saldo S₂ é:",
        choices: ["positivo", "zero", "negativo"],
        correctIndex: 2,
        explain: "O país importou mais do que exportou. O saldo é negativo, perto de −0,3 bilhão.",
      },
    ],
    conclusion: "Do maior para o menor: S₁ (4,5), S₃ (2,3) e S₂ (negativo). É a alternativa A.",
  },
  practice: {
    qs: ["2025-163", "2025-167", "2025-169"],
    note: "Três questões reais com gráfico, da mais acertada para a menos acertada no Enem 2025. Sem ajuda; o Raio-X vem depois.",
  },
  traps: [
    {
      q: "2025-154",
      key: "A",
      share: 31.2,
      edition: 2025,
      title: "Uma frase verdadeira que não responde",
      text: [
        "Na questão 154 de 2025, a livraria vai encomendar o gênero cujo estoque não cobre a demanda. Ficção tem a maior demanda, 160, e isso é verdade.",
        "Mas o estoque de ficção é 80 + 120 = 200, que cobre a demanda. A alternativa A diz algo certo sobre o gráfico e não responde ao comando.",
        "A certa é autoajuda: o estoque de 50 + 80 = 130 fica abaixo da demanda, de cerca de 136.",
      ],
    },
    {
      q: "2024-152",
      key: "D",
      share: 24.8,
      edition: 2024,
      title: "Olhar a altura de uma linha só",
      text: [
        "Quem olhou só a linha das exportações viu junho de 2010 no ponto mais alto e pôs S₃ em primeiro. É a alternativa D.",
        "Saldo é a distância entre as duas linhas no mesmo mês, não a altura de uma delas.",
      ],
    },
  ],
  cards: [
    { front: "O que ler primeiro num gráfico?", back: "Título, eixos e legenda: o que foi medido, em que unidade e o que cada cor representa." },
    { front: "Para que serve cada tipo de gráfico?", back: "Setores: partes de um total. Barras: comparar quantidades. Linhas: mudança ao longo do tempo." },
    { front: "Num gráfico com duas linhas, o que é a diferença entre elas?", back: "É a distância entre as linhas no mesmo ponto do eixo, não a altura de uma delas." },
    { front: "Dois gráficos de anos diferentes: o que conferir?", back: "De qual gráfico e de qual ano vem cada número que entra na conta." },
  ],
};
