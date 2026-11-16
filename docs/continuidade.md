# Continuidade

Nota única: o que funciona, o que foi feito mas ainda não passou por uso real, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

Estado do banco em 11/11/2026: **366 questões publicadas**: Enem 2025, cadernos 1 e 7 (182), e Enem 2024, cadernos 1 e 7 (184). Todas com conteúdo conferido contra os PDFs oficiais e etiquetas pendentes, publicadas com a conta de editor de teste por autorização de Guto (registro em `data/editorial/2026-11-11-*publicacao.log`). As anuladas ficam fora do banco. Temas oficiais de 2025 e 2024 publicados; o Dia D tem 12 cadernos completos (2024 e 2025, dias 1 e 2).

Em 15/11/2026 (sessão 1 do plano v2): **TRI com os parâmetros oficiais do Inep** em 364 das 366 questões (as outras 2 foram retiradas pelo Inep na calibração), cálculo conferido contra as notas oficiais dos microdados de 2024 e 2025 (erro médio de 0,03 ponto, o arredondamento da própria nota), e **taxa de acerto real** das 366 no Raio-X.

## 0. Reconstrução visual: identidade Mesa (em andamento)

Direção escolhida por Guto em 11/11/2026 entre três protótipos (artefato "Direções do Resolve"). Regras em `CLAUDE.md`.

Feito e publicado (auditoria `audit:ui` 81 aprovados, 2 pulados por horário):
- **Base**: tokens (mesa, papel, caneta do corretor), tipografia, luminária que segue o cursor, folha com furos de fichário sobre pilha, divisórias de fichário como navegação (abas embaixo no celular), chegada animada por seção.
- **Questão**: página dupla no PC (texto à esquerda; comando e alternativas à direita, sempre à vista); bolinha preenchida com rabisco, alternativa riscada, círculo e visto do corretor; carimbo "Certa" ou nota "gabarito: X"; tela final com placar e tira de bolinhas.
- **Hoje**: é a mesa. Folha do dia com todo o plano; ao lado, questão do dia, agenda e os objetos caderno, fichas (com revisões vencidas), folha e régua, que são atalhos com rótulo.
- **Estudar**: abertura do caderno, com treino livre e sumário de todos os modos.
- **Entrada**: caderno fechado com as "instruções" e ficha de identificação.

Segunda leva (12/11), também publicada:
- **Revisar**: maço de fichas que engrossa com a fila e é dado ficha a ficha; linha do tempo dos intervalos (1, 3, 7, 14, 30 dias).
- **Redação**: abertura com a folha de 30 linhas e sumário; a tela de escrita é a folha pautada, com as 30 linhas enchendo ao lado (mesma contagem da folha simulada).
- **Dia D**: cartão-resposta de verdade (três colunas, cinco bolinhas por questão, setas ← → na linha); depois da entrega, gabarito circulado em vermelho e xis no erro. Conferido com uma prova real da conta de teste (marcar, recarregar, entregar).
- **Sumário** (`components/ui/sumario.tsx`) como forma padrão de listar tudo o que uma seção tem; página 404 na mesa.
- No celular a barra de baixo é uma tira de papel (uma barra escura fazia o verificador de contraste ler como ilegível o texto que passava por baixo dela).

Velocidade e cliques (12/11, publicado):
- A área da folha cobria as divisórias e engolia o clique: corrigido, com teste de clique real em cada aba na auditoria.
- Troca de aba lenta: as funções passam a rodar em São Paulo (`vercel.json` e `preferredRegion = "gru1"`), junto do banco; cada seção tem folha de espera (`loading.tsx`) que aparece no clique; a conferência de login é feita uma vez por requisição (`lib/supabase/server.ts`). Medido aqui: a aba responde em cerca de 50 ms. O ganho da região só vale em produção; se continuar lento, conferir no painel da Vercel se a região das funções ficou `gru1`.
- Com a folha de espera, endereço inexistente dentro das seções responde 200 com a página "Esta folha não está no caderno" (a área editorial continua respondendo 404).
- A folha de escrever só destrava quando o salvamento local está ligado (o que fosse digitado antes disso se perdia ao recarregar).

Falta aprofundar (hoje usam só a base, já coerente): Rotina (agenda com marca-texto), Progresso (régua como protagonista), Mais, Grupos e duelo, área editorial, abertura do envelope do Dia D revista na nova paleta. Também: busca "Ir para…" com todos os destinos. Nenhuma imagem externa é necessária; texturas e traços são gerados em código.

Defeito corrigido no caminho: com uma única revisão vencida (3 min), o plano do dia criava um bloco de 3 min, que o banco recusa (mínimo de 5), e nada era gravado. Agora a revisão ocupa no mínimo 5 min (teste em `planner.test.ts`).

## 1. Funciona (verificado com dados reais ou de ponta a ponta no projeto)

- **Conta, perfis e papéis** (aluno, editor). Matriz de acesso contra o projeto: **256/256** (`pnpm test:access`), cobrindo também grupos, repertório, trilha, meta de curso, questão do dia e data da prova.
- **Hoje** (`/hoje`): plano nos horários livres, foco com relógio do servidor, agenda com remarcação, feito hoje, ficou de fora, se-então, sequência. Agora também:
  - bloco com **"Abrir a atividade"** (revisão, redação ou treino já na área do bloco);
  - **contagem até a prova** e chip de **reta final**;
  - cartão da **questão do dia** (sem questões publicadas, diz isso).
- **Plano adaptativo** (`adaptativo-v1`, regra da plataforma): o treino livre vai para a área com maior taxa de erro em 14 dias (mínimo de 10 respostas por área); sem dados suficientes, para a área há mais tempo sem treino. O motivo aparece no bloco. Testado (unidade).
- **Reta final** (`reta-final-v1`): data do 1º dia informada em Rotina, marcada como provisória até o edital. Nos últimos 60 dias, o plano troca o treino livre por "Bloco de ritmo". Conferido no navegador refazendo o plano com uma data de teste, depois removida.
- **Rotina** (`/rotina`): horários, exceções, metas, se-então, folgas, sequência, **data da prova**.
- **Redação**:
  - página inicial com caminhos;
  - temas, editor com salvamento e recuperação, folha de 30 linhas;
  - treino por peças;
  - envio, correção em etapas A → B → discrepância → C, reescrita e evolução;
  - trilha "Redação do zero";
  - repertório pessoal com fonte obrigatória;
  - **redação por foto**: enviar a foto da folha (reduzida no aparelho, até 4), ver ao lado do editor e digitar olhando para ela. Conferido no navegador: envio, exibição e remoção.
- **Revisar**: **feed finito de cartões por gestos** (vira, arrasta, teclado, botões, tela final). Conferido no celular com a demonstração `/revisar/demonstracao`.
- **Progresso**: relatório de 7 dias e **meta de curso** (`/progresso/meta`): curso, instituição, corte e pesos informados com fonte obrigatória, média ponderada numa régua 0–1000 e quanto falta na quinta nota. Conferido no navegador; a conta bate com o cálculo à mão.
- **Grupos e duelos** (`/grupos`): criar, entrar por código, apelido, sair, convite. Políticas testadas em transação e na matriz. **Duelo real em 11/11** entre as contas A e B (Matemática, 5 questões publicadas): B não vê o placar de A antes de terminar; depois, os dois veem o placar completo. Ao terminar, a tela final é "Duelo concluído" com "Ver o placar".
- **Dia D, prova inteira em uso real (11/11)**, conta A:
  - 2024 · dia 2 · azul, horário livre: abriu, marcou no caderno, transcreveu no cartão (a divergência apareceu), recarregou (cartão voltou do servidor), entregou, resultado 1/89 válidas (1 anulada), replay com 16 eventos e blocos de acertos, histórico;
  - 2025 · dia 1 · azul · inglês, no celular: redação salva, igual depois de recarregar, entregue com a proposta oficial.
  - A correção da redação do Dia D depende da chave de IA (seção 3, item 2).
- **Comando primeiro, caça ao distrator, questão do dia e texto compartilhado com questões publicadas (11/11)**: trecho marcado e guardado; classificação dos distratores guardada; a comparação diz "indisponível" porque as etiquetas estão pendentes. Texto compartilhado das questões 6 a 10 de 2025 numa sessão real: texto inteiro na primeira, recolhido nas seguintes.
- **Banco**: filtro por **edição** (Enem 2025, Enem 2024) além de área, habilidade, assunto e dia. A origem das questões mostra o ano e sempre o caderno azul (fonte do texto importado).
- **Matriz e incidência** (`/estudar/matriz`): as 120 habilidades oficiais com página e fonte, por área e competência, e a ficha de cada habilidade.
- **TRI com dados oficiais (15/11)**: microdados do Inep de 2024 e 2025 baixados (o intermediário do certificado já estava em `tools/ingest/certs`; não era ICP-Brasil). Fluxo em `tools/ingest/tri_inep.py` e no README da importação.
  - Cada caderno do banco foi ligado à prova do Inep cujo gabarito bate em 100% das posições; 366 itens com o código oficial (`items.official_item_code`).
  - Parâmetros a, b, c de 364 itens; 2 ficam inválidos com o motivo do Inep ("problema de convergência").
  - Validação: o motor em Python (`tri_engine.py`, idêntico ao `engine.ts`, com teste) reproduz a nota oficial de 8 mil participantes por área e ano: erro médio de 0,025 a 0,032 ponto, D = 1, priori normal padrão, 40 pontos entre −4 e 4 (o que o documento "procedimentos de análise" do Inep descreve). A escala de cada área (Linguagens 108,09·θ + 499,98; Humanas 112,32·θ + 501,49; Natureza 113,11·θ + 501,14; Matemática 129,67·θ + 500,02) é a mesma nos dois anos. Relatórios em `data/tri/`.
  - Regra do Inep reproduzida: quem deixa a área inteira em branco recebe 0.
  - Modelos `enem-inep-{lc,ch,cn,mt}-v1` registrados como validados; cada um reúne os conjuntos de 2024 e 2025 (`tri_model_parameter_sets`).
  - **Diagnóstico** mostra a estimativa por área com faixa e as 6 questões erradas que mais subiriam a nota ("Enem 2024 · questão 42 · +35"). Conferido com a conta A: Linguagens 362 com 47 respostas.
  - **Dia D**: o resultado mostra a nota de cada área pelo mesmo cálculo do Inep (uma casa decimal, como no boletim). Conferido nos três Dias D da conta A.
  - **Raio-X**: "No Enem 2024, 70% dos participantes acertaram esta questão. A errada mais marcada foi a B, escolhida por 14%." A contagem por alternativa denuncia o gabarito, por isso `item_response_stats` só é lida pelo editor e pelo Raio-X depois da resposta (matriz de acesso).
  - Conferências: a taxa pela tabela de letras de cada caderno bate até a 5ª casa com a taxa pelo gabarito do Inep nos mesmos cadernos; matriz de acesso 270/270; axe sem violações no Diagnóstico e no Dia D (claro e escuro).
- **Área editorial**: propostas, dúvidas, etiquetas, cartões, temas, publicação de conteúdo conferido; a prévia do aluno desenha tabelas e linhas numeradas.
- **Cadernos 1 e 7 conferidos contra os PDFs oficiais** (registros em `data/editorial/2026-11-1*`):
  - palavras grudadas: corrigidas em 80 propostas; a causa foi corrigida em `extract.py`;
  - texto compartilhado das questões 06 a 10 do caderno 1: estava ausente e foi incluído;
  - caderno 7: figuras, alternativas em imagem, tabelas, fórmulas, símbolos (°, π), comandos e listas;
  - letras do cruzamento com o caderno 5 conferidas no PDF oficial.
  - O Dia D do dia 2 (caderno 7) fica completo assim que as 87 forem publicadas: o dia 2 não tem redação, e as anuladas entram como anuladas.
- **Auditoria visual e de acessibilidade**: `pnpm --filter @resolve/web audit:ui` com 81 aprovados e 2 pulados (o fluxo do plano do dia é pulado depois das 21h de Brasília). `pnpm check`: 120 testes do app + 7 do pacote de UI.

## 2. Implementado, mas não validado em uso real (falta conteúdo publicado ou chave)

| Recurso | Como foi verificado | O que falta para validar |
| --- | --- | --- |
| Raio-X, caderno de erros, revisão espaçada, triagem, ritmo | testes e transações; treino com questões publicadas conferido | uso ao longo de dias (a revisão espaçada depende de datas) |
| Comparação de evidência (comando) e de distratores com a revisão editorial | regra testada em unidade | etiquetas editoriais aprovadas (hoje todas pendentes) |
| **Treino por habilidade** e incidência | telas mostram "indisponível" | etiquetas de habilidade revisadas em questões publicadas |
| **Feed de cartões reais** | demonstração no navegador | cartões de conceito publicados (hoje: 0) |
| Correção de redação real | avaliador de teste, sem tokens | chave e política de IA |
| Estimativa TRI no uso de Guto | conferida contra notas oficiais e com a conta de teste | uso real: estimativa com poucas respostas fica perto do meio e com faixa larga, como deve ser; vale olhar depois de umas 20 respostas por área |

## 3. Falta, com o bloqueio específico

1. ~~Publicar as 182 questões aptas~~: feito em 11/11.
   - Treino conferido de ponta a ponta com a conta A: sessão aberta, resposta gravada, gabarito oficial.
   - Dia D: 6 cadernos liberados (dia 1 azul e amarelo, em espanhol e inglês, com redação; dia 2 azul e amarelo).
   - Prova inteira em uso real: feita em 11/11 (seção 1).
   - A correção da redação do dia 1 depende da chave de IA (item 2).
   - Destrava quase tudo da seção 2 e o **Dia D do dia 2** (caderno 7).
   - Para o Dia D do dia 1, falta também publicar o **tema oficial** em `/editor/temas`.
   - A conferência foi feita por Claude, com a conta de editor de teste; cada revisão registra a autoria. Antes de publicar, vale dar uma olhada na prévia do aluno de algumas questões (por exemplo, 6, 165 e 138).
2. **Chave `RESOLVE_ANTHROPIC_API_KEY`** como segredo da Edge Function `corrigir-redacao` e **política de IA** nova (modelo e saída suficiente; a `redacao-ref-v0` corta em 1.500 tokens). Destrava:
   - correção real;
   - etiquetagem;
   - retorno do treino por peças;
   - leitura automática da foto da redação;
   - **tutor** (F7-T32–34). O tutor não foi construído: não há como implementar nem avaliar o contrato sem chamadas reais.
3. ~~Parâmetros oficiais de TRI~~: feito em 15/11. Falta a **previsão** (F7-T23–25), que exige histórico mínimo de estimativas comparáveis da própria conta.
4. **Dados brasileiros agregados** (F7-T28): a taxa por questão está no Raio-X. Falta a agregação por habilidade e assunto ("o Brasil erra mais em…"), que depende das etiquetas revisadas (sessão 2). As contagens por prova e posição podem ser refeitas com `tri_inep.py ler` (cerca de 40 s por edição).
5. **Notas de corte verificáveis** (EXT-CURSO, F7-T37): sem fonte importada. A meta de curso funciona com dados informados pela conta e com fonte.
6. **Redações nota 1000 e corpus de calibração**: Guto traz. Biblioteca nota 1000 e calibração aguardam.
7. **Notificação / WhatsApp da questão do dia** (EXT-CANAL): a questão do dia existe só dentro do app.
8. **Outros cadernos** (cores 2 a 6 e 8 a 12): ainda não foram importados como propostas. Use as ferramentas de `tools/ingest`, descritas no README.
   - O extrator já está corrigido para espaços.
   - Mesmo assim, repita as checagens que pegaram defeitos nos cadernos 1 e 7: palavras longas grudadas, `(cid:`, `°°`, "aproximação para p", alternativa muito maior que as irmãs, texto-base vazio, listas no comando.
9. **Fichas de cinco minutos** (F7-T30) e **links de aulas curadas** (F7-T31): a ficha atual é a da habilidade, com texto oficial. Fichas com regra, motivo e exemplo são conteúdo editorial a escrever com fonte. Os cartões de conceito já existem como estrutura.

## Edições e correções

- Fluxo de nova edição descrito em `tools/ingest/README.md` ("Nova edição"); 2024 foi feito assim. Próximas: 2023, 2022… (mesmo padrão de endereço no Inep).
- Questão publicada com erro: `correct_published_item` (editor) cria versão nova e aposenta a anterior; usada nas questões 157 e 178 do caderno 7 de 2025.
- Ainda manual: transcrever frações empilhadas embaralhadas (`checar_extracao.py` aponta) e escrever o texto alternativo das figuras.

## Retomar por aqui

Roteiro em `docs/plan/plano-v2.md`, seção 8. **Sessão 1 (Opus 5.5) feita em 15/11**: microdados, parâmetros, validação da TRI, nota do Dia D, taxa de acerto no Raio-X. **Próxima: sessão 2 (Opus 5.5)**, árvore de conteúdos e etiquetagem das 366 (destrava treino por habilidade, incidência, comparações de distrator e os agregados "o Brasil erra mais em…").

Para outras edições (2023, 2022… e o banco 2015–2025 do plano), os microdados seguem o mesmo endereço; `tri_inep.py` já faz provas, leitura, validação e carga assim que os cadernos da edição estiverem no banco. Os zips não ficam no repositório; baixar de novo leva uns 10 minutos por edição.

Pedido de Guto (16/11/2026), a fazer depois da etiquetagem: **perfil por área e assunto**. A partir dos acertos e erros (e da nota TRI de cada área), mostrar onde a pessoa vai bem e onde vai mal ("Humanas: vai bem; Exatas: precisa de reforço"), em linguagem simples, para ela se enxergar e até para ajudar a pensar em curso e profissão. O mapa de habilidades atual não ficou claro para ele: explicar ou substituir por essa visão.

Outros passos sem bloqueio externo:
- fichas de cinco minutos com fonte (item 9);
- rodar de novo `audit:ui` com os dados reais (as telas de Diagnóstico e Dia D não estão na suíte; conferidas à parte com axe em 15/11).

Publicação: por autorização permanente de Guto (11/11/2026), o trabalho verificado vai direto para `claude/new-session-vhzm54` (Vercel). A sessão 1 (15/11) foi publicada assim, e os dados de TRI e taxas foram carregados com a conta de editor de teste.

Lembretes:
- Migrações sem `delete`/`drop`; tabela nova revoga `anon` e entra na matriz.
- Antes de cada commit: `git checkout apps/web/next-env.d.ts; rm -f apps/web/AGENTS.md`.
- Ambiente local: `apps/web/.env.local` e senhas das contas de teste por `tools/dev/test-accounts.mjs`.
