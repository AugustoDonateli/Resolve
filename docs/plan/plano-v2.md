# Resolve — Plano v2 (15 de novembro de 2026)

Pedido de Guto: um plano amplo, que vá além do que ele citou e procure o que está faltando ou passou batido. Parte do estado real em `docs/continuidade.md` (11 e 12/11). As regras do `CLAUDE.md` continuam: questões oficiais conferidas, nada inventado, identidade Mesa, segurança dos dados.

**Decisões de Guto (15/11)**
- Um ano até o ENEM 2027; o plano de estudo se ajusta às horas que a pessoa tem (seção 2B).
- Público: ele e uns 5 amigos convidados.
- Prova: ENEM 2027.
- Alvo: Ciência da Computação na UFES ou na UFV (Viçosa). O app deve permitir escolher outros cursos populares (Medicina, Direito etc.).
- IA: até US$ 10 por mês.
- Banco: provas regulares de 2015 a 2025.
- A onda de papel e câmera interessa.
- Certificado do Inep: Claude resolve.

**Quem faz o quê**
- **Opus 5.5 (extra):** dados, banco, lógica, TRI, conteúdo didático, importação de provas, testes.
- **Fable 5.2:** design, interface, animação, ilustração em código, experiência de uso.

Cada frente abaixo diz qual modelo usar. Seção 8 traz o roteiro de sessões.

---

## 1. Diagnóstico amplo: o produto visto de fora

Olhando o Resolve como um aluno que chega pela primeira vez, e não como lista de tarefas.

### 1.1 O que está bom
- **Ferramentas de treino:**
  - treino, Raio-X e revisão espaçada;
  - Dia D com cartão-resposta e replay;
  - triagem, ritmo, comando primeiro, caça ao distrator.
- **Rotina inteligente:** plano do dia, foco, sequência, reta final.
- **Redação:** editor, folha, peças, trilha, repertório.
- **Grupos e duelo.**
- **Meta de curso com média ponderada.**
- 366 questões reais publicadas.
- Identidade Mesa, que é única no mercado.

### 1.2 O que falta: o Resolve treina, mas não ensina
1. **Não existe conteúdo das matérias.** Não há aula, resumo, explicação de assunto, fórmulas organizadas nem trilha de Física, Química, Biologia, História, Geografia, Filosofia, Sociologia, Português, Literatura, Artes, Matemática, Inglês ou Espanhol. A página de habilidade mostra o texto oficial da matriz, que é escrito para professor, não para aluno.
2. **Não há mapa do que estudar.** O aluno não sabe o que cai, quanto cai, o que já domina e o que falta.
3. **As questões não estão etiquetadas** (habilidade, assunto, distratores, resolução). Sem isso, nenhum conteúdo se liga às questões.

### 1.3 O que falta: o Resolve não se explica
4. **Não há boas-vindas:** quem entra não sabe por onde começar nem o que cada seção faz.
5. **As mecânicas não são explicadas** onde aparecem: por que esta questão voltou hoje, o que é "plano adaptativo", como conta a sequência, o que significa "indisponível" na TRI, por que o treino foi para esta área.
6. **Não há ajuda, glossário nem busca.** Termos como TRI, distrator, habilidade, competência, triagem e coerência aparecem sem definição.
7. **O progresso não conta uma história.** Não há uma visão "você começou aqui, está aqui, o próximo passo é este".
8. **Há muitos modos sem guia de quando usar cada um:** treino, banco, comando, distrator, triagem, ritmo, Dia D, duelo.

### 1.4 O que passou batido
9. **Calendário do candidato:** inscrição, pedido de isenção, pagamento, local de prova, gabarito oficial, resultado, Sisu, Prouni e Fies. Nada disso existe, e perder um prazo anula um ano de estudo.
10. **Regras oficiais da prova:** documentos aceitos, caneta, horários, o que leva à eliminação, motivos de nota zero na redação, atendimento especializado. Tudo da cartilha e do edital oficiais, com fonte.
11. **Depois da nota:** como o Sisu funciona (pesos por curso, modalidades de concorrência, cotas, chamadas, lista de espera), Prouni e Fies. A meta de curso existe, mas sem dados oficiais de corte nem explicação do processo.
12. **Bem-estar:** ansiedade, sono, pausa, sinais de esgotamento, a semana da prova. A rotina mede tempo, mas não cuida de quem estuda.
13. **Língua estrangeira:** a escolha entre inglês e espanhol, com dicas e um diagnóstico para decidir.
14. **Operação de um app com 6 pessoas reais:**
    - convites e cota de IA;
    - termos de uso e privacidade para os amigos;
    - exportar e excluir dados;
    - cópia de segurança;
    - aviso de erro em produção;
    - limites dos planos gratuitos (Supabase e Vercel).
15. **Erratas de conteúdo:** a ocorrência de questão existe para o aluno; faltam o ciclo editorial de correção e o aviso a quem já respondeu.
16. **Mudança do Enem:** a proposta de 2028 não vale para 2027. O app precisa marcar o que é regra vigente e o que é proposta, por versão.

---

## 2. Frente 1 — Ensinar: currículo completo do Enem (Opus 5.5 para o conteúdo; Fable 5.2 para a forma)

A frente mais importante: transformar o Resolve de ferramenta de treino em **curso completo, ligado às questões reais**.

### 2.1 Mapa de conteúdos (Opus 5.5)
- **Fonte oficial:** a matriz do Enem lista os objetos de conhecimento de cada área. Eles viram a árvore do curso: área, depois disciplina, depois tema, depois assunto (cerca de 300 a 400 assuntos).
- Cada assunto se liga às habilidades da matriz e às questões reais que o cobram, pela etiquetagem (Frente 2).
- **Incidência real:** quantas vezes cada assunto caiu de 2015 a 2025, contado pelas questões etiquetadas, não estimado. Mostra "cai muito", "cai às vezes" e "raro", com o número e os anos.

### 2.2 Cada assunto vira uma lição (Opus 5.5 escreve, Guto revisa)
O formato detalhado, o estilo de escrita e as regras de interação estão em 2A. O resumo abaixo é a versão curta.

Formato fixo, pensado para o Enem:
1. **Em uma frase:** o que é e por que cai.
2. **O essencial:** explicação curta, com exemplo do cotidiano. O Enem cobra contexto.
3. **Como o Enem cobra:** 2 ou 3 questões reais resolvidas passo a passo, mostrando o raciocínio e não só a conta.
4. **Pegadinhas típicas:** os distratores que mais aparecem nesse assunto, com exemplos reais.
5. **Fórmulas e conceitos-chave:** viram cartões de revisão automaticamente.
6. **Treino:** questões reais desse assunto, das mais fáceis às mais difíceis (pela TRI, quando houver).
7. **Para ir além:** aulas gratuitas e públicas, com link e data de verificação.

Escritas por Opus nas sessões, sem gastar a API. Cada lição cita fontes e passa por revisão de Guto. Ordem de produção: as de maior incidência primeiro.

### 2.3 Trilhas por área (Opus 5.5 na lógica; Fable 5.2 no desenho)
- **Diagnóstico de entrada por área:** 15 a 20 questões reais que posicionam o aluno.
- **Trilha personalizada:** assuntos em ordem de pré-requisito, priorizando incidência alta e as lacunas do diagnóstico.
- **Domínio por assunto**, com regra explícita e explicada: "dominado" quando acerta questões diferentes, sem ajuda, em dias diferentes. O aluno vê por que algo está "dominado" ou "em construção".
- **Base que derruba nota:** matemática básica (frações, porcentagem, regra de três, potências, leitura de gráfico), interpretação de texto e leitura de enunciado longo. Trilha própria para quem tem lacuna.

### 2.4 Ciência de aprender, explicada ao aluno (Opus 5.5)
- **Prática de lembrar, espaçamento e intercalação:** o Resolve já faz. Uma página "Por que o Resolve funciona assim" explica, em linguagem simples, com fonte.
- **Calibração de confiança:** a confiança já é coletada na resposta. Mostrar onde o aluno acha que sabe e não sabe ("certeza alta, acerto baixo em Química orgânica").
- **Caderno de erros reflexivo:** depois de errar, uma pergunta curta ("o que eu faria diferente?"). Os padrões aparecem por semana.
- **Explique com suas palavras:** depois de uma lição, escrever um resumo de 3 linhas. Opcional; com IA, só dentro da cota.

### 2.5 Dicas e estratégias por área (Opus 5.5)
- Uma página por área: como as questões dela costumam ser, a armadilha mais comum e como gerenciar o tempo nela. Cada dica com selo: "regra oficial", "efeito da TRI", "consenso de professores" ou "depende de você".
- **Exemplos:**
  - Linguagens: texto longo e comando no fim (comando primeiro).
  - Matemática: unidades, gráficos e conta de cabeça versus no papel.
  - Natureza: contexto antes da fórmula.
  - Humanas: data, contexto e o "porquê".

---

## 2A. Como ensinar: o padrão das lições e do tutorial

Pedido de Guto (15/11): ensino de verdade, que não pareça feito por IA, sem palavras de efeito. Interação, imagem e animação só quando ajudam a entender. Esta seção vale para tudo que o aluno lê no Resolve: lições, fichas, dicas, tutorial, explicações de mecânica e mensagens da interface.

### 2A.1 Como escrever

O modelo é um bom professor de cursinho explicando na lousa para um aluno só: direto, concreto, com exemplo antes da regra.

- **Frases curtas.** Uma ideia por frase. Parágrafo de até 3 ou 4 linhas no celular.
- **Exemplo antes da regra.** Primeiro um caso concreto ("uma blusa de R$ 80 com 25% de desconto"); depois o nome e a fórmula.
- **Palavras do aluno.** Termo técnico só quando o Enem usa, e explicado na primeira vez em que aparece.
- **Dizer o que importa para a prova.** "No Enem, isso aparece quase sempre em gráfico de conta de luz" vale mais que um parágrafo de teoria.
- **Mostrar o erro comum** e por que ele parece certo.
- **Sem enfeite.** Ficam fora palavras e frases de efeito como "mergulhe", "jornada", "desvende", "domine de vez", "poderoso", "incrível", "segredo", "o guia definitivo", "vamos juntos", "prepare-se para", e também perguntas retóricas de abertura, exclamações e emojis.
- **Sem promessa.** Nada de "garante pontos" ou "nunca mais erre". Quando uma dica é opinião de professor, ela diz isso (selos da seção 2.5).
- **Sem encher.** Se uma frase pode sair sem perder informação, ela sai.
- **Teste final de cada texto:** ler em voz alta. Se soa como propaganda ou como resposta de chatbot, reescreve.

Exemplo do tom esperado (lição de porcentagem):

> Porcentagem é uma fração com denominador 100. 25% é 25 de cada 100, ou seja, um quarto.
>
> Para achar 25% de R$ 80, divida por 4: R$ 20. A blusa sai por R$ 60.
>
> O Enem gosta de aumentos e descontos seguidos. Um aumento de 10% seguido de um desconto de 10% não volta ao preço inicial: R$ 100 vira R$ 110 e depois R$ 99. Quem soma e subtrai as porcentagens marca R$ 100, que é justamente uma das alternativas.

### 2A.2 Estrutura de uma lição

Baseada em prática de lembrar, exemplo resolvido e retirada gradual da ajuda, que é o que mais funciona para aprender. Cada lição cabe em 10 a 15 minutos.

1. **Pergunta de entrada (1 min):** uma questão curta, antes de qualquer explicação. Não vale nota; serve para o aluno ver o que já sabe. Quem acerta com folga pode pular para o treino.
2. **Explicação curta (3 a 5 min):** o essencial, no estilo de 2A.1, com no máximo um recurso visual (2A.3).
3. **Exemplo resolvido:** uma questão real do Enem resolvida passo a passo, com o raciocínio escrito ("o comando pede X; no gráfico, isso é Y").
4. **Exemplo com lacunas:** outra questão real em que o aluno completa um ou dois passos. A ajuda diminui.
5. **Questão sozinho:** uma questão real sem ajuda, com o Raio-X depois.
6. **Pegadinhas:** os distratores mais comuns daquele assunto, com a alternativa real que pegou mais gente (quando houver dado do Inep).
7. **Resumo em cartões:** fórmulas e ideias-chave entram na revisão espaçada automaticamente.
8. **Para ir além:** uma ou duas aulas gratuitas, com link verificado.

A lição se adapta: errou a pergunta de entrada, ganha mais um exemplo; acertou o exemplo com lacunas de primeira, pula para a questão sozinho.

### 2A.3 Interação, imagem e animação: quando usar

**Regra:** um recurso só entra se resolver uma dificuldade específica daquele assunto que o texto sozinho não resolve. Antes de cada recurso, a sessão escreve em uma linha qual dificuldade ele resolve. Se não conseguir escrever essa linha, o recurso não entra. Lição sem nenhum recurso é normal.

Bons motivos, com exemplos:
- **Ver uma relação mudar** (o que acontece com Y quando X muda): mexer num controle e ver o efeito.
  - Física: lançamento oblíquo, mudando ângulo e velocidade.
  - Matemática: gráfico de função afim, mudando a e b.
  - Química: deslocamento de equilíbrio.
- **Ver passo a passo algo que a lousa faria em etapas:** etapas que avançam por toque, nunca sozinhas.
  - Balanceamento de equação.
  - Divisão celular.
  - Ciclo da água.
  - Montagem de um circuito.
- **Ler um gráfico, mapa ou tabela:** a figura real da questão do Enem, com marca-texto no ponto que importa.
- **Ordenar ou situar:**
  - linha do tempo em História;
  - mapa em Geografia, com a região destacada.
- **Treinar uma leitura:** o aluno grifa no texto o trecho que responde o comando e compara com o grifo revisado (já existe no "comando primeiro").

Fora:
- ilustração decorativa, foto de banco de imagens, mascote, animação de entrada em cada parágrafo;
- vídeo gerado;
- animação que roda sozinha durante a leitura (regra de movimento do `CLAUDE.md`);
- interação que é só clicar para revelar texto que podia estar ali.

Como são feitos:
- **Componentes de lição reutilizáveis**, desenhados na identidade Mesa (Fable 5.2):
  - controle deslizante com gráfico;
  - etapas por toque;
  - figura com marca-texto;
  - linha do tempo;
  - mapa com destaque;
  - grifo no texto;
  - exemplo com lacunas.

  Cada lição monta o que precisa a partir deles. Todos funcionam por teclado e toque e têm versão sem movimento.
- **Imagens:** figuras das questões oficiais ou desenhos em código (SVG). Nada de imagem externa sem fonte e licença.
- **Acessibilidade:** todo recurso tem texto equivalente. Quem não interage não perde conteúdo.

### 2A.4 Como uma lição é produzida e aprovada

1. **Opus 5.5** escreve a lição seguindo 2A.1 e 2A.2, com as questões reais etiquetadas daquele assunto e as fontes.
2. A lição passa por uma **checagem automática de estilo:** lista de palavras proibidas, tamanho de frase e de parágrafo, presença das partes obrigatórias.
3. **Fable 5.2** escolhe e ajusta os recursos visuais, só onde 2A.3 justifica.
4. **Guto lê e marca:** "entendi", "confuso aqui" (com um toque no trecho) ou "chato". O que for marcado volta para reescrita.
5. **Medida de que funcionou:** o acerto nas questões daquele assunto antes e depois da lição, mostrado a Guto. Lição que não melhora nada é revista.

**Piloto antes de escalar:** as três primeiras lições servem de molde. Proposta:
- porcentagem (Matemática, muito cobrada);
- leitura de gráficos (aparece em todas as áreas);
- interpretação do comando em Linguagens.

Só depois de Guto aprovar o jeito, as outras são produzidas em lote, na ordem de incidência.

### 2A.5 O tutorial do site

Aprender fazendo, na própria mesa, em vez de uma sequência de telas explicando tudo de uma vez.

1. **Primeira entrada (cerca de 3 minutos):** três perguntas na ficha de identificação: curso e instituição, horas por semana, inglês ou espanhol. A data da prova já vem preenchida com o ENEM 2027, provisória até o edital.
2. **Primeira questão de verdade:** a mesa abre com uma questão real fácil. O aluno responde e o Raio-X aparece pela primeira vez, com uma frase explicando o que é. É o primeiro contato com a mecânica principal.
3. **Tour curto da mesa:** cada objeto (caderno, fichas, folha, régua, agenda) é destacado um por vez, com uma frase:
   - "Aqui ficam as suas revisões. Uma questão errada volta amanhã, depois em 3 dias...";
   - avança por toque, pula a qualquer momento, nunca roda sozinho;
   - sem movimento para quem prefere reduzido.
4. **Dicas na primeira vez de cada recurso:** ao abrir triagem, ritmo, Dia D ou duelo pela primeira vez, uma ficha curta diz o que é, quando usar e quanto tempo leva. Aparece uma vez e fica guardada em "Como funciona".
5. **"Por quê?" sempre disponível** nas decisões automáticas (seção 5.2).
6. **Rever o tutorial** a qualquer momento, em Mais.

O que o tutorial não faz:
- vídeo de abertura;
- texto longo de boas-vindas;
- várias telas antes de chegar na mesa;
- tooltips em cascata.

Meta: em 5 minutos, o aluno respondeu uma questão real, sabe onde ficam as revisões e sabe o que fazer amanhã.

---

## 2B. Um ano de estudo: horas, volume de conteúdo e foco

Guto tem cerca de um ano até o ENEM 2027. O app precisa saber quanto tempo a pessoa tem, mostrar onde ela está e gastar cada hora no que mais sobe a nota **para o curso que ela quer**.

### 2B.1 Quanto conteúdo cabe em um ano

Conta com 50 semanas de estudo:

| Ritmo | Horas no ano |
|---|---|
| 1 h por semana | 50 h |
| 2 h por semana | 100 h |
| 1 h por dia | 350 h |
| 2 h por dia | 700 h |

Quanto custa cada bloco de conteúdo (estimativa de tempo de uso):

| Bloco | Volume | Tempo |
|---|---|---|
| Lições do currículo | cerca de 350 lições × 13 min | cerca de 75 h |
| Banco 2015–2025 resolvido uma vez | cerca de 2.000 questões × 3 min | cerca de 100 h |
| Dias D completos (dois dias de prova cada) | 10 provas × 10,5 h | cerca de 105 h |
| Redações com reescrita | 40 × 1,5 h | cerca de 60 h |
| Revisão espaçada | cerca de 20% do tempo total | variável |

O que isso quer dizer:
- **Com 1 a 2 h por dia (350 a 700 h):** cabe tudo — currículo completo, o banco inteiro, uns 10 Dias D, uma redação por semana e a revisão. Com 2 h por dia, as 2.000 questões terminam antes do fim do ano. Por isso as provas PPL e as reaplicações de 2015 a 2025 ficam como reserva, a serem importadas quando o banco estiver perto de acabar.
- **Com 1 a 2 h por semana (50 a 100 h):** não cabe o currículo inteiro. Mal cabem as lições. O app precisa escolher por você o que dá mais nota por hora, deixar claro o que ficou de fora e reservar algumas horas para pelo menos 2 Dias D e algumas redações.

O plano anual (2B.3) usa as horas que a pessoa informa e mostra o que cabe e o que não cabe. Nada de prometer o currículo inteiro para quem tem 1 hora por semana.

### 2B.2 Onde você está

Já existem peças (Dia D, nota por área quando houver TRI, relatório de 7 dias). O que falta é juntar numa medida clara e atualizada.

1. **Diagnóstico de entrada (cerca de 1 h, dividido em partes):**
   - 15 a 20 questões reais por área, escolhidas pela TRI para posicionar rápido (questões de dificuldade variada; quando a TRI estiver validada, escolha adaptativa);
   - uma redação curta, opcional;
   - resultado: nota estimada por área com faixa (ou "indisponível" sem parâmetros) e um primeiro mapa de assuntos.
2. **Mapa de domínio por assunto:** cada assunto em quatro estados com regra explícita:
   - não visto;
   - em construção;
   - dominando (acertos sem ajuda em questões diferentes);
   - dominado (o mesmo, em dias diferentes, incluindo revisão).

   O aluno toca num assunto e vê por que ele está naquele estado.
3. **Reavaliação mensal:** um mini Dia D de cerca de 1 h por mês, misturando áreas. A nota estimada por área vira uma linha no tempo, com a faixa de incerteza.
4. **Nota contra a meta:** a régua do curso (UFES ou UFV, Ciência da Computação, e outros cursos populares) mostra a média ponderada estimada contra o corte de referência, e quanto falta em cada área, já com os pesos do curso.

### 2B.3 Onde focar: o plano anual

O plano do dia já existe e já escolhe a área com mais erro. Ele passa a seguir um plano anual com uma regra de prioridade explicada ao aluno.

**Prioridade de um assunto:** pontos que ele pode render × peso da área no curso × quanto ainda falta dominar ÷ horas necessárias.
- **Pontos que pode render:** pela TRI, quando houver; até lá, pela incidência real do assunto nas provas.
- **Peso da área:** pelos pesos do Sisu do curso escolhido. Para Ciência da Computação, Matemática costuma pesar mais. O peso exato vem do dado oficial de cada instituição, na sessão de cursos.
- **Quanto falta:** pelo mapa de domínio.
- **Horas necessárias:** pelo tamanho da lição e do treino daquele assunto.

**Como o ano é dividido** (proporções iniciais, ajustadas pelo desempenho e mostradas ao aluno):
- **Meses 1 a 8:** base e conteúdo novo, com treino e revisão; um Dia D a cada 6 a 8 semanas; uma redação a cada 1 a 2 semanas.
- **Meses 9 a 11:** menos conteúdo novo, mais treino misturado, Dias D a cada 2 a 3 semanas, estratégia pessoal (seção 6).
- **Último mês:** reta final, que já existe: revisão, Dias D, protocolo de crise e semana da prova.

**O que o aluno vê:**
- "Esta semana: 3 lições de Matemática (função afim, porcentagem, estatística básica), 1 de Natureza, 40 questões, 1 redação." Cada item com o porquê ("Matemática pesa mais para Ciência da Computação e você está em construção em função afim").
- "Fica de fora este mês": o que não coube nas horas informadas, para a pessoa decidir se quer mais tempo.
- **Replanejamento automático** quando a pessoa estuda menos ou mais do que o previsto, sem apagar o que já foi feito.

### 2B.4 Questões que você não sabe
- **Treino de lacuna:** questões reais dos assuntos "em construção", da dificuldade logo acima do nível atual, nem fáceis demais nem impossíveis.
- **Caderno de erros por assunto:** os erros agrupados por assunto e por tipo de pegadinha, com a lição correspondente a um toque.
- **Questões que valem mais para você:** com a TRI, as questões cuja resposta certa mais sobe a nota estimada, ligadas ao "pontos baratos" da seção 4.2.

---

## 3. Frente 2 — Etiquetas e o banco completo (Opus 5.5)

### 3.1 Etiquetas das 366 publicadas (primeira sessão)
- Opus lê cada questão e propõe:
  - habilidade principal e secundária;
  - assunto (da árvore 2.1);
  - dependência de conteúdo;
  - evidência no texto;
  - tipo e justificativa de cada distrator;
  - resolução passo a passo.
- **Conferência relâmpago (Fable 5.2 desenha):** a questão e a sugestão, aprovar, ajustar ou devolver, com atalhos de teclado e fila por área. Meta: menos de 1 minuto por questão.
- Destrava treino por habilidade, incidência, comparação do Raio-X, trilhas e lições.

### 3.2 Banco de 2015 a 2025
- Uma edição por sessão, de 2023 para trás, pelo fluxo "Nova edição" de `tools/ingest`, já com a etiquetagem.
- Outras cores de 2024 e 2025, para o Dia D aceitar o caderno da cor que a pessoa quiser.
- Conferência por risco: figuras, tabelas e fórmulas primeiro; olhar rápido nas questões limpas.
- Texto alternativo das figuras escrito na sessão e conferido.
- **Meta:** cerca de 2.000 questões e 22 provas de Dia D.

### 3.3 Ciclo de errata
- A ocorrência relatada vira tarefa editorial. A correção publica uma versão nova, a antiga fica no histórico, e quem respondeu a versão com erro recebe um aviso. A nota não é recalculada em silêncio.

---

## 4. Frente 3 — TRI, nota e futuro (Opus 5.5)

### 4.1 Destravar os dados do Inep
- **Causa achada em 15/11:** os servidores do Inep usam certificado da cadeia ICP-Brasil, ausente do ambiente. Não é bloqueio de rede.
- **Correção:** acrescentar a raiz oficial da ICP-Brasil (ITI), conferida pela impressão digital publicada, à confiança do ambiente, por meio do script de configuração do ambiente, para valer em toda sessão. Sem desligar a verificação.
- **Importar dos microdados:** os parâmetros a, b e c de cada item e a taxa de acerto real por questão.

### 4.2 Nota validada
- **Anos sem parâmetro público:** estimar das respostas dos participantes, com o erro declarado.
- **Validação contra notas oficiais:** recalcular a nota de participantes reais (anônimos) dos microdados e publicar o erro médio por área e ano. Até lá, o rótulo é "cálculo experimental".
- **O que aparece:**
  - nota do Dia D com a calibração da edição;
  - nota por área com faixa;
  - radar de coerência;
  - cenários ("acertando estas 3 fáceis, +N pontos");
  - pontos baratos no plano adaptativo;
  - "X% do Brasil acertou".

### 4.3 Curso, corte e caminho (Opus 5.5 nos dados; Fable 5.2 na régua)
- **Cursos populares pré-carregados** com dados oficiais do Sisu, com ano, modalidade e fonte:
  - Medicina, Direito, Psicologia, Engenharias, Ciência da Computação, Enfermagem, Administração, Odontologia, Arquitetura, Pedagogia e outros;
  - foco inicial em UFES e UFV para Ciência da Computação, depois as demais federais.
- **Pesos por curso e instituição** (Sisu), média ponderada com a nota estimada e "quanto falta em cada área". Este é o maior ganho: um ponto em Matemática vale mais que um em Linguagens para quem quer CC.
- **Explicador do Sisu:** modalidades, cotas, chamadas, lista de espera. Prouni e Fies em resumo, com fonte.
- **Previsão honesta:** só com histórico suficiente de estimativas comparáveis. Antes disso, "indisponível".

---

## 5. Frente 4 — Entender o site (Fable 5.2 na forma; Opus 5.5 no texto e na lógica)

### 5.1 Boas-vindas que montam o plano
O desenho detalhado do tutorial está em 2A.5.

- **Primeira entrada, cerca de 5 minutos:**
  - prova-alvo e data;
  - curso e instituição;
  - horas por semana;
  - língua estrangeira;
  - um diagnóstico curto opcional.
- No fim, o aluno vê o próprio plano, a mesa montada e o que cada objeto da mesa faz.
- **Tour da mesa:** cada objeto (caderno, fichas, folha, régua, agenda) se apresenta uma vez, pulável e com movimento reduzido.

### 5.2 Mecânicas explicadas onde acontecem
- **"Por quê?" ao lado de cada decisão automática:**
  - por que esta questão voltou;
  - por que o treino foi para Natureza;
  - por que a sequência continua;
  - por que a nota está indisponível.

  Cada um leva a uma explicação curta e, dali, à página completa.
- **Central "Como o Resolve funciona":** revisão espaçada, TRI, plano adaptativo, domínio, sequência e folga, triagem, ritmo, Dia D, correção de redação, cota de IA. Cada página com uma ilustração em código e um exemplo com os dados do próprio aluno.
- **Glossário** sempre a um toque: TRI, distrator, habilidade, competência, coerência, eixo temático, modalidade de concorrência.

### 5.3 Organização e navegação
- **Reorganização do Estudar** em três portas claras:
  - **Aprender:** trilhas e lições.
  - **Praticar:** treino, banco e treinos de habilidade, cada um com "quando usar".
  - **Provar:** Dia D e simulados.
- **Busca "Ir para…"** por tela, assunto, habilidade ou questão.
- **Progresso como história:** linha do tempo do aluno (o que estudou, o que dominou, como a nota estimada mudou) e "próximo passo" sempre visível.
- **Novidades:** quando algo novo entra no app, uma nota curta na mesa.

---

## 6. Frente 5 — Estratégia de prova e o Dia D (Opus 5.5 na lógica e no conteúdo; Fable 5.2 nas cenas)
- **Manual do Dia D**, com selos de evidência:
  - linha do tempo dos dois dias;
  - documentos, caneta, horários e eliminação;
  - motivos de nota zero na redação;
  - atendimento especializado.

  Tudo da cartilha e do edital vigentes, conferido quando sair o de 2027.
- **Sua estratégia descoberta pelos seus dados:** experimentos nos Dias D (redação primeiro ou depois, ordem das áreas, três passadas). Comparação de nota, tempo e coerência. Resultado: "seu plano para o Dia D".
- **Protocolo de crise de 60 segundos**, treinado no "Dia D sob pressão" (relógio curto e questão difícil plantada no começo).
- **Treino de chute consciente** (eliminar o impossível sob tempo) e do cartão-resposta.
- **Calendário do candidato:** inscrição, isenção, pagamento, local de prova, gabarito, resultado, Sisu, Prouni e Fies, com lembretes no celular e links oficiais. Datas de 2027 só quando publicadas; antes, "a confirmar".
- **Semana da prova:** logística, sono, alimentação, horário, ficha de crise.

---

## 7. Frentes 6 a 9

### Frente 6 — Redação completa (Opus 5.5 no conteúdo; Fable 5.2 na folha)
- **Trilha por competência**, com exemplos reais e as redações nota 1000 quando Guto trouxer.
- **Repertório por eixo temático**, com fonte verificável. Os eixos mais cobrados vêm da lista real de temas de 2015 a 2025.
- **Checklist de revisão sem IA:** cinco competências e cinco elementos da proposta de intervenção.
- **Correção por IA na cota**, com evidência no texto e "o que reescrever primeiro". Rotulada como estimativa até calibrar.
- **Foto da folha lida pela IA** (hoje é transcrição manual), com conferência antes de corrigir.

### Frente 7 — Clube dos 6 (Opus 5.5 nos dados e no acesso; Fable 5.2 na sala)
- **Convites só do dono** (link ou código com validade e limite), membros, suspender, remover com exclusão de dados.
- **Cota de IA:** cerca de US$ 1,50 por pessoa por mês dentro dos US$ 10, com folga do dono. Gasto real por chamada, aviso aos 70%, bloqueio no teto, reserva antes de cada chamada, cache compartilhado: uma explicação gerada serve a todos.
- **Sala de estudo ao vivo**, foco sincronizado e desafio semanal.
- **Dia D fantasma** contra o ritmo de um amigo ou o seu próprio passado.
- **Duelo de Raio-X.**
- Nota de ninguém exposta sem consentimento.

### Frente 8 — Papel de verdade (Opus 5.5 na leitura; Fable 5.2 no fluxo)
- **Prova em PDF** para imprimir: Dia D ou lista personalizada, com cartão-resposta impresso.
- **Cartão-resposta pela câmera:** o app lê as bolinhas (processamento de imagem no aparelho, sem custo de IA). A digitação fica como plano B.
- **Redação manuscrita:** foto, leitura, transcrição conferida, correção na cota.

### Frente 9 — Operação e confiança (Opus 5.5)
- **Termos e privacidade para os amigos**, em linguagem simples.
- **Exportar meus dados e excluir conta**, com redações e anexos.
- **Cópia de segurança do banco** e um ensaio de restauração.
- **Aviso de erro em produção** e painel de saúde: erros, lentidão, custo de IA, limites dos planos gratuitos.
- **Limites de uso** contra abuso (envios, convites, IA).
- **Versão das regras:** o que é vigente em 2027 e o que é proposta para 2028, marcado em cada tela.

### Frente 10 — Mesa completa, movimento e celular (Fable 5.2)
- **Terminar a Mesa** em Rotina (agenda com marca-texto), Progresso (régua como protagonista), Mais, Grupos, área editorial e envelope do Dia D.
- **As novas telas** (lições, trilhas, central de ajuda, boas-vindas, calendário, cursos) já nascem na Mesa.
- **Os três momentos autorais:**
  - abertura do caderno no Dia D;
  - passagem entre etapas;
  - replay minuto a minuto.
- **Ilustrações em código** para as explicações de mecânicas: curva da TRI, linha de revisão espaçada, mapa de domínio.
- **App instalável (PWA):** offline nas revisões e lições, avisos de revisão vencida, questão do dia e prazos do calendário.
- Auditoria de acessibilidade e de desempenho no celular.

---

## 8. Roteiro de sessões, com o modelo de cada uma

Sessões curtas, uma frente (ou metade) por sessão. Cada uma termina com um tour de capturas e atualiza `docs/continuidade.md`.

| # | Modelo | Sessão |
|---|---|---|
| 1 | Opus 5.5 | Certificado ICP-Brasil no ambiente; parâmetros e taxas do Inep; validação da TRI (4.1, 4.2) |
| 2 | Opus 5.5 | Árvore de conteúdos e etiquetagem das 366 (2.1, 3.1) |
| 3 | Fable 5.2 | Conferência relâmpago para Guto; tutorial: primeira entrada, primeira questão, tour da mesa, dicas da primeira vez (3.1, 2A.5) |
| 4 | Opus 5.5 | Convites, membros, cota de IA, termos, exportar e excluir (7, 9) |
| 5 | Opus 5.5 | Cursos e cortes do Sisu, pesos, CC UFES e UFV, explicador do Sisu (4.3) |
| 6 | Fable 5.2 | Régua da nota e do curso; progresso como história; reorganização do Estudar (4.3, 5.3) |
| 7 | Opus 5.5 | Piloto: lições de porcentagem, leitura de gráficos e comando em Linguagens; checagem automática de estilo (2A.1, 2A.2, 2A.4) |
| 8 | Fable 5.2 | Componentes de lição (controle com gráfico, etapas por toque, figura com marca-texto, linha do tempo, mapa, grifo, lacunas) aplicados ao piloto; Guto aprova o molde (2A.3) |
| 9–11 | Opus 5.5 | Lições em lote, por incidência, no molde aprovado: Matemática e Natureza, depois Humanas e Linguagens (2.2, 2.5) |
| 12 | Fable 5.2 | Trilhas e mapa de domínio; central "Como funciona" e glossário (2.3, 5.2) |
| 13 | Opus 5.5 | Plano anual pelas horas informadas, prioridade por curso, diagnóstico de entrada, mapa de domínio, reavaliação mensal, treino de lacuna (2B, 2.3, 2.4) |
| 14 | Opus 5.5 | Estratégia pessoal, protocolo de crise, calendário do candidato, manual do Dia D (6) |
| 15 | Fable 5.2 | Cenas do Dia D (abertura, sob pressão, replay); terminar a Mesa nas telas restantes (6, 10) |
| 16 | Opus 5.5 | Redação: trilha por competência, repertório, checklist (6); ligar a chave e a correção na cota |
| 17 | Fable 5.2 | Folha de redação, foto da folha, sala de estudo e Dia D fantasma (6, 7) |
| 18–21 | Opus 5.5 | Edições de 2023 a 2015, uma por sessão, com etiquetas (3.2) |
| 22 | Opus 5.5 | Papel: PDF, leitura do cartão pela câmera (8) |
| 23 | Fable 5.2 | PWA, avisos, acessibilidade e desempenho no celular (10) |

**Regra para os dois modelos não se atropelarem:** uma sessão por vez na branch `claude/new-session-vhzm54`. Fable mexe em `components/`, `globals.css`, `lib/ink` e `packages/ui`; Opus mexe em `lib/`, `supabase/`, `tools/` e no conteúdo. Cada sessão começa lendo `docs/continuidade.md`.

**Como pedir:** "Leia `docs/plan/plano-v2.md` e `docs/continuidade.md` e faça a sessão N do roteiro."

---

## 9. Outras ideias (para escolher depois)
- **Professor de bolso por voz:** explicar a resolução em voz alta e o app transcrever no aparelho e comparar com a resolução revisada. Sem custo de IA na transcrição, se o aparelho fizer.
- **"Modo Enem real" de fim de semana:** o app trava as outras funções, o relógio segue o horário oficial de Brasília (portão, início, fim), e a pessoa faz a prova no papel em casa.
- **Gêmeo de desempenho:** com a TRI validada, simular como seria a nota com mais N horas em cada assunto, usando o histórico real do aluno, com a incerteza explícita.
- **Mapa do Brasil das questões:** onde no país cada questão foi mais difícil, pelos microdados.
- **Livro de bolso automático:** gerar em PDF o resumo pessoal, com só os assuntos que o aluno ainda não domina, para revisar no ônibus.

---

## 10. Riscos
- **Volume de conteúdo:** 300 a 400 lições é muito trabalho. Ordem por incidência, lições curtas e revisão de Guto em lotes.
- **Parâmetros faltando em alguns anos:** estimar dos microdados, com o erro medido.
- **Cerca de 2.000 questões para conferir:** ordem por risco, olhar rápido nas limpas.
- **IA dentro de US$ 10:** teto rígido, cache compartilhado, IA só onde precisa ser na hora. Conteúdo pesado é escrito nas sessões.
- **Direitos:** uso num grupo fechado; revisar antes de abrir para fora.
- **Dados do Sisu:** só oficiais, com ano e fonte. Sem eles, a meta continua com dados informados pela pessoa.
