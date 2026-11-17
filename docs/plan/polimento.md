# Polimento do Resolve (proposta de 16/11/2026)

Pedido de Guto: polir o site inteiro, do detalhe (fonte, tamanho de texto, animação) ao radical (reorganizar seções), com ideias novas para grupos e para o site aprender com o aluno. **Aprovado por Guto em 16/11 ("pode aplicar tudo")**, com dois acréscimos: deixar claro em cada tela o que é aquilo e o que fazer (bloco H) e refazer a abertura do Dia D, em que as peças se atravessam. O plano de implementação está no fim desta nota, junto com o que ainda falta do roteiro.

Base: capturas enviadas por Guto (Hoje, Estudar, Redação, Rotina e Mais, tema escuro, tela larga).

## A. Base visual (vale para todas as telas)
1. **Fonte dos títulos menores.** Instrument Serif é estreita e fina; em 26–30 px (títulos de seção, "Ficha de identificação", "Treino livre") fica apertada, pior no escuro. Proposta: Instrument Serif só no título grande da tela; títulos de seção em Newsreader 500 (já carregada). Alternativa: trocar a serifa de títulos inteira, mostrando duas opções lado a lado antes.
2. **Tela larga.** A folha fica solta no meio, com uma faixa vazia entre as divisórias e a folha; as divisórias deixam de "sair da folha". Ancorar a folha junto às divisórias e limitar a largura de leitura.
3. **Tema escuro.** Folha e mesa têm quase a mesma cor e a metáfora some; fichas e folha de redação viram retângulos escuros. Papel escuro mais claro e quente, sombra visível, objetos com identidade.
4. **Uma ação azul por tela** (Hoje tem duas; Rotina, três) e campos com a mesma cara em todo formulário.
5. **Folhas pela metade** (Redação, Mais): a altura acompanha o conteúdo.

## B. Estudar em três portas
Hoje: treino + sumário de 9 itens + triagem + ritmo na mesma página.
- **Praticar**: treino livre (agora com escolha por habilidade e assunto, liberada pelas anotações) e banco de questões.
- **Treinar a prova**: comando primeiro, caça ao distrator, triagem e ritmo, cada um com "quando usar" em uma linha.
- **Provar**: Dia D e diagnóstico.
- No alto, **uma sugestão para agora**, tirada dos dados da conta, com o motivo.
- Matriz e incidência saem daqui e vão para Progresso (consulta).

## C. Mais sem bagunça
- Remover Protótipos de movimento e Componentes (ficam só para o editor).
- Tirar o que repete a navegação (Rotina, Progresso).
- Três grupos: Conta e preferências; Ajuda (Como funciona, Ficha de identificação); Editor (só para editor).
- Grupos sai do Mais e ganha lugar próprio (objeto na mesa e entrada no Estudar).

## D. Grupos: competir pelo tempo de estudo
Referências: YPT/Yeolpumta (grupo vê quem está estudando agora e o ranking de tempo por dia, semana e mês), Duolingo (liga semanal que sobe e desce), StudyRank (duelo semanal 1×1 de tempo), StudyMaxer (meta coletiva do grupo), Flipd (desafios por dia, semana e mês).
1. **Ranking semanal de tempo** do grupo: soma do foco, das questões e da redação, medidos pelo servidor; zera na segunda.
2. **"Estudando agora"**: quem do grupo está em foco neste momento.
3. **Meta coletiva da semana** (ex.: 40 h somadas): cooperação junto com a disputa.
4. **Duelo de tempo 1×1** por semana; o duelo de questões continua.
5. **Outros placares**: questões respondidas, dias seguidos, revisões em dia e **evolução** (quem mais melhorou em relação à própria semana anterior, justo para quem tem menos tempo).
6. **Resumo de domingo** e aplauso entre colegas.
Cuidados: só conta tempo medido pelo app com atividade (ninguém digita horas), teto diário, aparece só apelido e totais, entrar no ranking é escolha de cada um.

## E. O site aprende com você
1. **Perfil por área e assunto** (pedido de 16/11): onde vai bem e onde precisa de reforço, em linguagem simples. Liberado pelas anotações aprovadas.
2. **Seu padrão de erro**: o tipo de alternativa errada em que você mais cai, com treino dirigido.
3. **Seu tempo**: onde gasta demais e ainda erra; o alvo do ritmo passa a ser o seu.
4. **Dificuldade na medida**, pela TRI: questões logo acima do seu nível.
5. **Seu melhor horário**: quando você rende mais, e o plano passa a sugerir esse horário.
6. **Revisão que se ajusta**: o intervalo de cada ficha muda conforme você acerta ou erra (hoje é fixo).
7. **"O que o Resolve aprendeu esta semana"**: página curta, com o porquê de cada decisão automática.

## F. Animações
1. **Abertura do envelope do Dia D**: refazer na Mesa e corrigir o defeito.
2. Revisar as outras cenas antigas (replay, constelação) na mesma régua.
3. Passar as transições pequenas (troca de questão, abrir Raio-X, concluir bloco).

## G. Telas a reorganizar
- **Rotina**: três formulários viram uma agenda da semana em que se marca direto no dia.
- **Redação**: rascunhos com nome (hoje, três "Tema livre" iguais) e "continuar" em destaque.
- **Progresso**: linha do tempo do aluno com "próximo passo".
- **Hoje no primeiro uso**: um caminho só enquanto não há horários marcados.

## H. Cada tela diz o que é e o que fazer (acréscimo de Guto)
O site tem muita função e pouca orientação. Regra para todas as seções:
- **Uma frase no alto** dizendo para que serve a tela e por onde começar.
- **Caminho numerado** onde há sequência. Redação: escolher o tema → escrever → enviar → ler a correção → reescrever, com o passo atual marcado. Estudar: as três portas, cada uma com "quando usar".
- **"Por quê?"** ao lado de cada decisão automática (por que esta questão, por que este bloco, por que a nota está indisponível), com explicação curta.
- **Estados vazios que ensinam**: em vez de "Nenhum…", o primeiro passo.
- Nomes iguais em todo lugar (o mesmo recurso não pode ter dois nomes).

## Plano de implementação
Cada etapa é um conjunto completo: implementar, conferir no navegador (claro, escuro, celular e tela larga), `pnpm check`, build, `audit:ui`, matriz de acesso quando mexer no banco, publicar. Marcar aqui o que foi feito.

| Etapa | O que entra | Modelo |
| --- | --- | --- |
| P1 | **Feita (16/11).** **Base visual e Mais** (A1–A5, C): fonte dos títulos de seção, folha ancorada na tela larga, papel do tema escuro, uma ação azul por tela, altura das folhas; Mais em três grupos, sem Protótipos e Componentes | Fable |
| P2 | **Feita (16/11).** **Abertura do Dia D refeita** (F1): cena nova na Mesa, peças em camadas fixas (nada atravessa nada), pulável, sem movimento para quem prefere reduzido | Fable |
| P3 | **Feita (16/11).** **Estudar em três portas** (B, H): Praticar, Treinar a prova, Provar; sugestão para agora com o motivo; treino por habilidade e assunto; matriz em Progresso | Fable |
| P4 | **Feita (17/11).** **Redação e Rotina claras** (G, H): caminho numerado da redação, rascunhos com nome; agenda da semana em que se marca direto no dia; Hoje no primeiro uso | Fable |
| P5 | **Feita (17/11).** **Grupos: tempo de estudo** (D1–D3, D5): tempo medido pelo servidor, ranking semanal, "estudando agora", meta coletiva, placares; lugar próprio na mesa | Fable (telas) com cuidado de banco |
| P6 | **Feita (17/11).** **O site aprende, parte 1** (E1, E2, E7): perfil por área e assunto, padrão de erro, página "o que o Resolve aprendeu" | Fable |
| P7 | **Feita (17/11).** **Grupos, parte 2 e animações** (D4, D6, F2, F3): duelo de tempo, resumo de domingo, aplauso; replay, constelação e transições pequenas | Fable |
| P8 | **O site aprende, parte 2** (E3–E6): tempo pessoal, dificuldade pela TRI, melhor horário, revisão com intervalo ajustável; Progresso como história | Opus ou Fable |

## O que falta do roteiro, depois do polimento
(`docs/plan/plano-v2.md`, seção 8)
- **Sessão 4**: convites, membros, cota de IA, termos, exportar e excluir a conta.
- **Sessão 5**: cursos e cortes do Sisu, pesos, explicador do Sisu. A régua do curso (sessão 6) entra junto com "Progresso como história" (P8).
- **Ensinar, não só exercitar** (sessões 7 a 11 e 13): hoje o site só tem exercício. Falta o curso: lições curtas com exemplo antes da regra, ligadas às questões reais pelas anotações (piloto: porcentagem, leitura de gráficos e comando em Linguagens; depois o molde aprovado por Guto e a produção em lote por incidência), trilhas, mapa de domínio e plano anual pelas horas informadas na ficha.
- **Sessões 14 a 23**: estratégia de prova e manual do Dia D, redação por competência com a chave de IA, tutor, e o restante.
- Pendências externas: chave de IA, redações nota 1000, notas de corte com fonte.


## Registro
- **P1 (16/11)**: títulos de seção em Newsreader 500 (`.t-section`; a serifa estreita fica só nos tamanhos grandes e em números); folha ancorada junto das divisórias, com altura pelo conteúdo; papel do tema escuro mais claro e quente (tokens em `packages/ui`, contraste conferido pelo teste); em Hoje e Rotina só uma ação azul; Mais em três grupos (Estudar junto, Ajuda, Editor), sem o que repete as abas; Protótipos e Componentes só aparecem para editor. Grupos continua no Mais até ganhar lugar próprio (P5).
- **P2 (16/11)**: `components/motion/envelope-opening.tsx` refeito. Cena plana, vista de cima, sobre a mesa: lacre rompe, aba dobra, caderno sai, envelope é puxado para fora, capa assenta. Peças em camadas fixas, sem rotação em profundidade (era o que fazia as peças se atravessarem). Cerca de 3 s; Pular e Esc desde o início; movimento reduzido mostra a capa direto. Conferida quadro a quadro.
- Verificações de P1 e P2: `pnpm check`, build e `audit:ui` (87 aprovados, 1 pulado).
- **P3 (16/11)**: Estudar virou três portas (Praticar, Treinar a prova, Provar), cada uma com "quando usar" em cada treino; no alto, uma **sugestão para agora com o porquê** (`lib/study/suggestion-rule.ts`, regra `sugestao-v1`: fichas vencidas, depois a área do plano adaptativo, depois treino livre), só "Começar treino" em azul. A matriz saiu do Estudar e está em Progresso. Falta desta etapa: escolha por habilidade e assunto direto no treino livre (hoje é pelo banco, com filtros). Verificação: `pnpm check`, build, `audit:ui` 85 aprovados; falhou só o teste antigo "plano de hoje" de `rotina.spec.ts`, que depende do horário (rodou perto das 21h de Brasília) e não toca nesta tela.
- **Correção da P1 (17/11)**: Guto não gostou da folha ancorada à esquerda (sobrava um vazio enorme à direita em tela larga). Agora divisórias e folha ficam juntas e **centradas na mesa** (`--shell-pad` em `.desk`; `app-shell.tsx`): até 1500 px ocupa tudo, acima disso a sobra se divide por igual. Não voltar a ancorar à esquerda nem a separar as divisórias da folha. Verificado em 1440, 1700 e 2470 px; auditoria de navegação, iPhone e tutorial: 51 aprovados.
- **P4 (17/11)**:
  - **Hoje no primeiro uso**: sem horários, a folha pergunta "Quando você pode estudar?" e oferece **horários rápidos** (segunda a sexta ou todos os dias; manhã, tarde ou noite), que marcam o horário livre com um toque (`addStudyPreset`, um pedido só; colisão não grava nada). Componente `components/routine/quick-hours.tsx`, também no alto da Rotina quando não há horário.
  - **Rotina**: em cada um dos próximos 7 dias há "Marcar horário neste dia", que abre o formulário ali mesmo, com o dia da semana já escolhido ("Marcar toda terça"). O formulário geral continua em "Toda semana".
  - **Redação**: no alto, o caminho de uma redação em cinco passos (escolher o tema, escrever, enviar, ler a correção, reescrever), com o passo atual marcado e o link para ele (`lib/essay/path.ts`, com teste). Rascunhos com nome: o tema, o começo do texto ou "Folha em branco", no lugar de várias linhas "Tema livre".
  - Não feito nesta etapa: Rotina como grade visual da semana (ficou a lista de dias com marcação no próprio dia) e o "Por quê?" nas demais decisões automáticas (há em Estudar e nos blocos do plano).
  - Verificação: `pnpm check`, build, capturas em PC e celular; `audit:ui` 81 aprovados na rodada cheia, com uma falha que era do teste (link "Temas" ambíguo, corrigido) e travou 4 dependentes; o projeto do editor repetido passou 15 de 15.
- **P5 (17/11)**: **placar da semana** em cada grupo (`/grupos/[id]`), acima dos duelos.
  - Regra `tempo-v1` (migração `20261117120000_grupos_tempo_de_estudo.sql`, função `private.study_seconds`): tempo de foco pelo relógio do servidor (até 3 h por período) mais o tempo ativo em cada questão (até 15 min), com períodos sobrepostos contados uma vez só e teto de 12 h por dia; semana de segunda a domingo, horário de Brasília. Ninguém digita horas.
  - Ranking por tempo, com questões respondidas, dias com estudo, "estudando agora" e a comparação com a própria semana anterior; **meta coletiva** em horas somadas, com barra; **participar é escolha de cada pessoa em cada grupo** (`share_time`, desligado por padrão): de quem não participa só aparece o apelido, e cada um sempre vê o próprio tempo.
  - Objeto "Grupos" na mesa de Hoje (o atalho em Mais continua).
  - Testado no banco em transação desfeita (três períodos de foco sobrepostos e um de 5 h deram 16.208 s: sobreposição contada uma vez, limite de 3 h aplicado; antes de participar, o colega recebe só o apelido). Matriz de acesso 304/304. `audit:ui` 86 aprovados, 2 pulados (o do plano do dia é pulado depois das 21h). 150 testes de unidade.
  - Não validado em uso real: tempos de verdade (as contas de teste têm segundos de estudo). Redação ainda não entra na conta: o editor não mede tempo ativo.
  - Ficaram para a P7: duelo de tempo 1×1, resumo de domingo e aplauso.
- **P6 (17/11)**: Progresso passou a abrir com **o perfil por área** (pedido de Guto de 16/11).
  - Função `learning_profile()` (migração `20261117130000_perfil_de_aprendizado.sql`): só somas das questões que a própria conta respondeu (primeira tentativa, sem ajuda), por área, por tema da matriz (com a disciplina em Natureza) e por tipo da alternativa errada marcada. Conta comum continua sem ler anotações nem taxas direto.
  - Regra `perfil-v1` (`lib/profile/rule.ts`, com teste): compara o acerto da conta com o acerto médio de quem fez o Enem **nas mesmas questões**; 10 pontos percentuais acima é "Você vai bem", 10 abaixo é "Precisa de reforço", no meio é "Na média". Só classifica com 10 respostas na área e 5 no tema; antes diz quantas faltam. Só chama de ponto forte o que está na média ou acima.
  - Cada área mostra também a **nota estimada pela TRI**, com a faixa (mesmo cálculo do Diagnóstico, feito no servidor). Saiu o texto antigo que dizia que a TRI estava indisponível.
  - **Padrão de erro**: o tipo de alternativa errada mais marcado, com a definição e o treino indicado; aparece com 5 erros de tipo identificado.
  - **"O que o Resolve aprendeu sobre você"**: o que o site sabe e o que faz com isso (sugestão de agora com o motivo, erro mais comum, horas por semana, data da prova), dizendo também o que ainda não muda nada.
  - O "Mapa de habilidades", que Guto achou confuso, saiu da tela; a matriz e o diagnóstico ficaram em "Para consultar".
  - Verificação: conferido com os dados reais da conta de teste A; matriz de acesso 308/308; `audit:ui` 86 aprovados e 2 pulados; 150+ testes de unidade.
  - Limites: não sugere curso nem profissão (seria invenção); mostra como a pessoa está hoje. O padrão de erro ainda só informa, não muda o sorteio do treino (fica para a P8).
- **P7 (17/11)**:
  - **Aplauso**: quem está no ranking pode aplaudir a semana de um colega (uma vez por semana por pessoa); a contagem aparece no placar.
  - **Duelo de tempo**: "Desafiar no tempo" cria o duelo da semana entre duas pessoas do ranking; vence quem tiver mais tempo até domingo. Um duelo por dupla por semana, qualquer que seja o lado que desafiou.
  - **Semana passada**: resumo em frases (quem ficou em 1º, quanto o grupo somou, a posição da conta, aplausos e resultado dos duelos de tempo); só aparece se alguém do ranking estudou.
  - Banco: `20261117140000_grupos_aplauso_duelo_de_tempo.sql` (tabelas `group_applause` e `time_duels`, sem acesso direto; funções `applaud_member`, `challenge_time_duel`, `group_week_recap`; `group_week_board` passou a trazer aplausos e duelos). Tudo vale só entre quem está no ranking. Matriz de acesso 320/320.
  - **Animações**: troca de questão chega de lado (240 ms) e o Raio-X sobe como folha (400 ms), sem deslocamento com movimento reduzido; o **replay do Dia D** ganhou uma linha do tempo com um traço por evento e a caneta azul no instante atual.
  - Conferido no navegador com as contas A e B (aplauso e desafio aparecem para os dois). `audit:ui`: 85 aprovados na rodada cheia; o teste do tutorial falhou uma vez sob carga e passou duas vezes seguidas sozinho. 157 testes de unidade.
  - Não feito: a constelação (o protótipo ficou sem entrada depois que o mapa de habilidades saiu do Progresso; decidir se some de vez) e aviso fora do app para o resumo de domingo (o resumo aparece na página do grupo).
