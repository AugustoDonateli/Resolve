import type { Lesson } from "../types";

export const porcentagem: Lesson = {
  slug: "porcentagem",
  title: "Porcentagem",
  area: "MT",
  subjectCode: "MT.1.2.4",
  minutes: 12,
  status: "piloto",
  oneLine:
    "Porcentagem é uma fração com denominador 100. No Enem, ela aparece em preço, desconto, aumento, nota e pesquisa, quase sempre dentro de uma situação do dia a dia.",
  entry: {
    prompt: "Uma camiseta custa R$ 60 e está com 20% de desconto. Quanto você paga?",
    options: [
      { text: "R$ 12", feedback: "R$ 12 é o valor do desconto. Falta tirar esse valor dos R$ 60." },
      { text: "R$ 40", feedback: "Tirar R$ 20 não é o mesmo que tirar 20%. 20% de 60 é 12." },
      { text: "R$ 48", correct: true, feedback: "Isso. 20% de 60 é 12, e 60 − 12 = 48. Direto: 60 × 0,80 = 48." },
      { text: "R$ 50", feedback: "Um desconto de R$ 10 em R$ 60 é menos de 20%. 20% de 60 é 12." },
    ],
  },
  explanation: [
    "Porcentagem é uma fração com denominador 100. 25% quer dizer 25 de cada 100, que é o mesmo que um quarto. 50% é a metade. 10% é um décimo.",
    "Para fazer conta, troque a porcentagem pelo número decimal. Basta dividir por 100, ou seja, andar com a vírgula duas casas para a esquerda. 25% vira 0,25. 135,25% vira 1,3525.",
    "Aumento e desconto viram multiplicação. Aumentar 20% é multiplicar por 1,20: o valor inteiro mais 20%. Dar 20% de desconto é multiplicar por 0,80: sobram 80% do valor. Esse número que multiplica se chama fator.",
    "Aumentos e descontos seguidos se multiplicam, não se somam. R$ 100 com aumento de 10% vira R$ 110. Com desconto de 10% depois, vira R$ 99, e não R$ 100: o desconto foi calculado sobre os R$ 110.",
    "O Enem também cobra a diferença entre por cento e pontos percentuais. Se uma nota cai de 75% para 45%, ela caiu 30 pontos percentuais. Se ela cai 30% a partir de 75%, fica em 75 × 0,70 = 52,5%.",
    "Antes de calcular, ache a base: o valor que vale 100%. Em “30% a menos que João”, a base é o que João acertou. Errar a base é o erro mais comum nesse assunto.",
  ],
  extraExample:
    "Mais um exemplo. Uma conta de luz de R$ 150 teve aumento de 8%. O valor novo é 150 × 1,08 = R$ 162. O aumento em reais é 162 − 150 = R$ 12, que é 8% de 150.",
  worked: {
    q: "2024-140",
    correct: "B",
    intro: "Uma questão de 2024 que pegou muita gente justamente na diferença entre por cento e pontos percentuais.",
    steps: [
      "O comando pede os conceitos de João e de Felipe. O conceito depende da porcentagem de acertos de cada um.",
      "João acertou 75% de 200 questões: 200 × 0,75 = 150 questões. Pela lista, 75% fica em 75 ≤ P < 90, que é muito bom.",
      "Felipe acertou 30% a menos que a quantidade de João. A base é essa quantidade, 150. Então Felipe acertou 150 × 0,70 = 105 questões.",
      "Em porcentagem, 105 de 200 é 105 ÷ 200 = 0,525, ou 52,5%. Pela lista, 50 ≤ P < 60, que é regular.",
      "Resposta: muito bom e regular, alternativa B.",
    ],
    afterNote:
      "Quem fez 75% − 30% = 45% chegou a insatisfatório e marcou C. Foi quase o mesmo tanto de gente que acertou: 32,9% marcaram C e 34,5% marcaram B.",
  },
  gapped: {
    q: "2025-158",
    correct: "C",
    intro: "Agora você completa as contas desta questão de 2025. Escreva só o número, com vírgula para os centavos.",
    gaps: [
      {
        kind: "numero",
        label: "O seguro de R$ 36,00 por veículo vai aumentar 20%. Quanto fica o seguro novo, em real?",
        answer: 43.2,
        tolerance: 0.01,
        hint: "Aumento de 20% é multiplicar por 1,20.",
        explain: "36 × 1,20 = 43,20.",
      },
      {
        kind: "numero",
        label: "Quanto o estacionamento precisa arrecadar por mês? Some a manutenção (14 240), o seguro dos 120 veículos e o lucro de 10 000.",
        answer: 29424,
        tolerance: 0.5,
        hint: "O seguro dos 120 veículos é 120 × 43,20 = 5 184.",
        explain: "14 240 + 5 184 + 10 000 = 29 424.",
      },
      {
        kind: "numero",
        label: "Qual é a mensalidade de cada um dos 120 clientes, em real?",
        answer: 245.2,
        tolerance: 0.01,
        hint: "Divida o total por 120.",
        explain: "29 424 ÷ 120 = 245,20. É a alternativa C.",
      },
    ],
    conclusion: "A porcentagem foi só o primeiro passo. No Enem, ela costuma vir no meio de uma conta maior, como aqui.",
  },
  practice: {
    qs: ["2024-153", "2024-143"],
    note: "Duas questões reais de porcentagem, sem ajuda. Depois de cada resposta, o Raio-X mostra a resolução.",
  },
  traps: [
    {
      q: "2024-140",
      key: "C",
      share: 32.9,
      edition: 2024,
      title: "Tirar pontos em vez de tirar por cento",
      text: [
        "“30% a menos que João” é 30% da quantidade de João. Não é tirar 30 da porcentagem dele.",
        "Quem fez 75% − 30% = 45% chegou a insatisfatório e marcou a alternativa C.",
      ],
    },
    {
      q: "2025-140",
      key: "A",
      share: 36.9,
      edition: 2025,
      title: "Calcular o que não foi pedido",
      text: [
        "Na questão 140 de 2025, a solução tem 10 litros e 99,95% dela é S₁. Então S₂ é 0,05% de 10 litros, ou 0,005 litro. Esse número é a alternativa A.",
        "Mas a pergunta é quanto de S₁ sai. S₂ não muda e passa a ser 0,10% da solução nova. Logo, a solução nova tem 0,005 ÷ 0,001 = 5 litros.",
        "Saem 10 − 5 = 5 litros de S₁: alternativa E. Só 9,0% acertaram. A parte que não muda é a que dá a conta.",
      ],
    },
  ],
  cards: [
    { front: "Como transformar uma porcentagem em número decimal?", back: "Divida por 100: a vírgula anda duas casas para a esquerda. 35% = 0,35. 135,25% = 1,3525." },
    { front: "Aumento de 20%: multiplica por quanto?", back: "Por 1,20. Em geral, aumento de x% é multiplicar por 1 + x/100." },
    { front: "Desconto de 20%: multiplica por quanto?", back: "Por 0,80. Em geral, desconto de x% é multiplicar por 1 − x/100." },
    { front: "Aumento de 10% seguido de desconto de 10% volta ao valor inicial?", back: "Não. 1,10 × 0,90 = 0,99: o valor final é 1% menor." },
    { front: "Cair 30% é o mesmo que cair 30 pontos percentuais?", back: "Não. De 75%, cair 30 pontos dá 45%. Cair 30% dá 75 × 0,70 = 52,5%." },
  ],
};
