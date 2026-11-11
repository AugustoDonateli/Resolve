# Continuidade

Nota única: o que funciona, o que foi feito mas ainda não passou por uso real, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

Estado do banco em 11/11/2026: **366 questões publicadas**: Enem 2025, cadernos 1 e 7 (182), e Enem 2024, cadernos 1 e 7 (184). Todas com conteúdo conferido contra os PDFs oficiais e etiquetas pendentes, publicadas com a conta de editor de teste por autorização de Guto (registro em `data/editorial/2026-11-11-*publicacao.log`). As anuladas ficam fora do banco. Temas oficiais de 2025 e 2024 publicados; o Dia D tem 12 cadernos completos (2024 e 2025, dias 1 e 2). 0 parâmetros de TRI.

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
- **TRI**: motor EAP 3PL configurável, testado contra integração fina e com cenários não aditivos. O diagnóstico diz "indisponível" (sem parâmetros oficiais) e tem demonstração marcada.
- **Área editorial**: propostas, dúvidas, etiquetas, cartões, temas, publicação de conteúdo conferido; a prévia do aluno desenha tabelas e linhas numeradas.
- **Cadernos 1 e 7 conferidos contra os PDFs oficiais** (registros em `data/editorial/2026-11-1*`):
  - palavras grudadas: corrigidas em 80 propostas; a causa foi corrigida em `extract.py`;
  - texto compartilhado das questões 06 a 10 do caderno 1: estava ausente e foi incluído;
  - caderno 7: figuras, alternativas em imagem, tabelas, fórmulas, símbolos (°, π), comandos e listas;
  - letras do cruzamento com o caderno 5 conferidas no PDF oficial.
  - O Dia D do dia 2 (caderno 7) fica completo assim que as 87 forem publicadas: o dia 2 não tem redação, e as anuladas entram como anuladas.
- **Auditoria visual e de acessibilidade**: `pnpm --filter @resolve/web audit:ui` com 81 aprovados e 2 pulados (fluxos que dependem de plano do dia na conta de teste). `pnpm check`: 120 testes do app + 7 do pacote de UI.

## 2. Implementado, mas não validado em uso real (falta conteúdo publicado ou chave)

| Recurso | Como foi verificado | O que falta para validar |
| --- | --- | --- |
| Raio-X, caderno de erros, revisão espaçada, triagem, ritmo | testes e transações; treino com questões publicadas conferido | uso ao longo de dias (a revisão espaçada depende de datas) |
| Comparação de evidência (comando) e de distratores com a revisão editorial | regra testada em unidade | etiquetas editoriais aprovadas (hoje todas pendentes) |
| **Treino por habilidade** e incidência | telas mostram "indisponível" | etiquetas de habilidade revisadas em questões publicadas |
| **Feed de cartões reais** | demonstração no navegador | cartões de conceito publicados (hoje: 0) |
| Correção de redação real | avaliador de teste, sem tokens | chave e política de IA |
| TRI com números | motor testado com parâmetros fictícios marcados | parâmetros oficiais do Inep por item |

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
3. **Parâmetros oficiais de TRI** (microdados do Inep, inacessíveis daqui). Destrava a estimativa por área e a **previsão** (F7-T23–25). A previsão exige ainda histórico mínimo de estimativas comparáveis.
4. **Dados brasileiros agregados** (F7-T28): precisam dos microdados (mesmo bloqueio do item 3). Nada foi construído para não sugerir dado ausente.
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

As questões publicadas já foram percorridas com as contas de teste (Dia D, comando, distrator, questão do dia, texto compartilhado, duelo). Edições anteriores (2023, 2022…) ficaram para depois, a pedido de Guto. Próximos passos sem bloqueio externo:
- revisão das etiquetas de habilidade e de distratores pela área editorial (destrava treino por habilidade, incidência e as comparações);
- fichas de cinco minutos com fonte (item 9);
- rodar de novo `audit:ui` com os dados reais.

Publicação: por autorização permanente de Guto (11/11/2026), o trabalho verificado vai direto para `claude/new-session-vhzm54` (Vercel).

Lembretes:
- Migrações sem `delete`/`drop`; tabela nova revoga `anon` e entra na matriz.
- Antes de cada commit: `git checkout apps/web/next-env.d.ts; rm -f apps/web/AGENTS.md`.
- Ambiente local: `apps/web/.env.local` e senhas das contas de teste por `tools/dev/test-accounts.mjs`.
