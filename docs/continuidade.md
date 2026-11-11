# Continuidade

Nota única: o que funciona, o que foi feito mas ainda não passou por uso real, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

Estado do banco em 11/11/2026: **182 questões publicadas** (cadernos 1 e 7 do Enem 2025: LC 50, CH 45, CN 43, MT 44), com conteúdo conferido e etiquetas pendentes. A publicação foi autorizada por Guto nesta conversa e feita com a conta de editor de teste; está registrada na nota do lote (`data/editorial/2026-11-11-publicacao.log`). As 3 questões anuladas do caderno 7 ficam fora do banco. Tema oficial de 2025 ("Perspectivas acerca do envelhecimento na sociedade brasileira") publicado em 11/11, também por autorização de Guto. Os 6 textos motivadores, os créditos e as 2 figuras foram conferidos contra a p. 20 do PDF oficial. 0 parâmetros de TRI.

## 1. Funciona (verificado com dados reais ou de ponta a ponta no projeto)

- **Conta, perfis e papéis** (aluno, editor). Matriz de acesso contra o projeto: **259/259** (`pnpm test:access`), cobrindo também grupos, repertório, trilha, meta de curso, questão do dia e data da prova.
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
- **Grupos e duelos** (`/grupos`): criar, entrar por código, apelido, sair, convite. Políticas testadas em transação e na matriz.
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
| Estudo, Raio-X, caderno de erros, revisão espaçada, banco, triagem, ritmo | testes e transações | questões publicadas |
| **Comando primeiro** e **caça ao distrator** (`/estudar/comando`, `/estudar/distrator`) | funções testadas em transação; demonstrações no navegador | questões publicadas; a comparação com o gabarito editorial só sai com etiquetas aprovadas |
| **Questão do dia** (`daily_question`) | sem questões, devolve vazio sem erro | questões publicadas |
| **Texto compartilhado** | testes de agrupamento e marcação; aparência conferida numa página temporária | questões publicadas que compartilham texto-base |
| **Duelos** (lançar, jogar, placar revelado só depois de terminar) | políticas e placar testados em transação; faixa do placar conferida com dados de exemplo | ao menos 5 questões publicadas e duas contas jogando |
| **Treino por habilidade** e incidência | telas mostram "indisponível" | etiquetas de habilidade revisadas em questões publicadas |
| **Feed de cartões reais** | demonstração no navegador | cartões de conceito publicados (hoje: 0) |
| **Dia D** completo no projeto | fluxo validado em PostgreSQL local (Codex); catálogo e recusa conferidos no projeto | um caderno com as 90 posições publicadas e o tema oficial do dia 1 |
| Correção de redação real | avaliador de teste, sem tokens | chave e política de IA |
| TRI com números | motor testado com parâmetros fictícios marcados | parâmetros oficiais do Inep por item |

## 3. Falta, com o bloqueio específico

1. ~~Publicar as 182 questões aptas~~: feito em 11/11.
   - Treino conferido de ponta a ponta com a conta A: sessão aberta, resposta gravada, gabarito oficial.
   - Dia D: 6 cadernos liberados (dia 1 azul e amarelo, em espanhol e inglês, com redação; dia 2 azul e amarelo).
   - Falta fazer uma prova inteira em uso real.
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

## Retomar por aqui

Enquanto Guto não publica: novos cadernos (item 8) ou recursos independentes. Depois que as questões forem publicadas, percorrer a seção 2 com as contas de teste: estudo, comando, distrator, questão do dia, texto compartilhado, duelo entre A e B, treino por habilidade.

Lembretes:
- Migrações sem `delete`/`drop`; tabela nova revoga `anon` e entra na matriz.
- Antes de cada commit: `git checkout apps/web/next-env.d.ts; rm -f apps/web/AGENTS.md`.
- Ambiente local: `apps/web/.env.local` e senhas das contas de teste por `tools/dev/test-accounts.mjs`.
