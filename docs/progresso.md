# Progresso por ID

Backlog completo: `docs/plan/Resolve-pacote.md`, Parte B (182 tarefas). Este arquivo registra só o estado. Critérios de pronto ficam no backlog.

Legenda: ✅ concluída (critério verificado) · 🟡 parcial (o que falta está descrito) · ⛔ bloqueada por dependência externa · ⬜ não iniciada.

## F1 — Design e contratos

| ID | Estado | Evidência / o que falta |
|---|---|---|
| F1-T01 | ✅ | `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` passam. Nenhuma chave no repositório. |
| F1-T02 | ✅ | Tokens em `packages/ui`, testes de contraste reproduzem os valores do §6 e cobrem todos os pares usados nos dois temas. Amarelo/rosa nunca são texto. Preferência persiste em `localStorage`. Marca "Resolve" é uma primeira proposta, com refinamento do desenho final pendente. |
| F1-T03 | ✅ | Botão, campo, alternativa e foco em `/componentes`. Teclado e axe verificados. Toque testado só em emulação: falta aparelho real (registrar em F1-T08). |
| F1-T04 | ✅ | Lateral de 216 px (≥ 960 px) e cinco destinos no celular. O foco vai ao título após navegar. Indicador contínuo. |
| F1-T05 | ✅ | Os PDFs já existem (F2-T06), então o bloqueio EXT-PDF caiu. Componente `QuestionView` (texto-base, comando e alternativas na ordem da fonte; figura ampliável em diálogo, Esc devolve o foco) com a questão real Q119 do caderno 7 (6 figuras, alternativas em figura) na **prévia do aluno** `/editor/proposta/[id]/previa` (só editor, sem gabarito, avisa figuras sem texto alternativo). Ponta a ponta: 360/390/1440 px sem rolagem e sem alternativa cortada, 6 figuras carregadas, axe. Unitários de conversão proposta/publicada. O mesmo componente serve ao resolver (F3-T02). |
| F1-T06 | 🟡 | Comentário aponta para o trecho e as camadas são independentes (`/redacao`). Falta verificar "teclado móvel não encobre ação": a tela ainda não tem campo de texto. Conferir quando houver resposta/reescrita. |
| F1-T07 | ✅ | Hoje + agenda com dados demonstrativos identificados. Remarcação por arrasto e por formulário usa a mesma regra (`canPlace`, com testes). |
| F1-T08 | 🟡 | Celular de referência: **iPhone**. Projeto `iphone` na suíte (emulação iPhone 15: alvos ≥ 24 px, fluxos por toque) e roteiro para o aparelho em `docs/validation/roteiro-iphone.md`. **Concluída em emulação** (`docs/validation/2026-11-09-f1-t08-auditoria.md`). Suíte repetível `pnpm audit:ui`: 42/42 (12 vistas + 360/768 px, zoom 200%, leitura 22 px, teclado, foco encoberto, estrutura). Cinco correções feitas, incluindo uma falha WCAG 2.5.3. Falta a passada no aparelho de referência: toque, teclado virtual e leitor de tela. |
| F1-T09 | ✅ | `docs/motion/storyboard-momentos.md`. |
| F1-T10 | ✅ | `/prototipos/envelope`: formas CSS 3D + GSAP seguindo Q0–Q5. Cena medida em 5,00 s. **Pular** e Esc visíveis desde o primeiro quadro e levam à capa final. Cronômetro parado em 05:30:00 durante toda a cena, iniciando só em **Começar prova**. Variante sorteada entre dois cadernos demonstrativos. Reduzido = capa direta. Produção final: F7-T08 a T14. |
| F1-T11 | ✅ | `/prototipos`: passagem medida em 607 ms. Esc ou novo clique terminam na etapa de destino, com foco no título. |
| F1-T12 | ✅ | `/prototipos/replay`: dez eventos demonstrativos. O cartão-resposta vira linha do tempo (cada bolinha viaja até o evento que a produziu). Escala indicada (1 s = 3 min). Pausar mantém a posição. Evento anterior/próximo e seleção abrem o detalhe do evento. Tabela equivalente. Reduzido: sem reprodução animada, navegação por evento. |
| F1-T13 | ⬜ | Liberada. Exige cinco sessões de Guto por variante. |
| F1-T14 | ⛔ EXT-FOTOS | — |
| F1-T15 | ✅ | `/prototipos/constelacao`: quatro nós com estado pela regra do §7 (testada: 6 casos). Abrir um nó leva os pontos de tentativa até a lista das oito referências recentes e mostra cada critério atendido ou faltante. Funciona por toque e teclado (Esc devolve o foco ao nó). Tabela equivalente. A adoção da transformação (R0-P03) ainda depende da avaliação de Guto. |
| F1-T16 | ✅ | `docs/motion/mapa-de-movimentos.md` (sete coreografias com quadros, interrupção e alternativa reduzida). |
| F1-T17 | ✅ | Hoje → foco → histórico em PC e celular. Interrupção aos 120 ms, caminho só por teclado e clique repetido verificados. Gravações em `docs/validation/recordings`. |
| F1-T18 | 🟡 | Raio-X e troca de competência prontos e gravados. Evidência e comentário ficam ligados, e o ritmo é controlado pelo aluno. Falta repetir com questão real quando F1-T05 sair do bloqueio. |

## F2 — Conta, conteúdo e dados

| ID | Estado | Evidência / o que falta |
|---|---|---|
| F2-T01 | ✅ | Projeto Supabase `resolve` (sa-east-1). Login por e-mail e senha, sessão por cookies, `proxy.ts` protege as telas, preferências salvas na conta. Criar conta = e-mail + senha, ativa na hora, sem e-mail de confirmação (pedido de Guto). Cadastro restrito a e-mails liberados. API 17/17 + 8/8, interface 6/6 + fluxo de criação (`docs/validation/2026-11-09-f2-t01.md`). |
| F2-T02 | ✅ | Esquema versionado (fontes só acrescentam, matriz publicada imutável) e carga da matriz oficial do INEP (abril 2026): 5 eixos, 30 competências, 120 habilidades, conferidas texto a texto contra o PDF e por hash no banco. Teste de duas versões coexistindo e de imutabilidade passou. Perfil Enem 2025 (referência). |
| F2-T03 | ✅ | Itens, versões, estímulos, alternativas, cadernos, mapa de letras (chave composta impede alternativa de outro item ou de outra versão), figuras. Publicar exige 5 alternativas e 1 correta; versão publicada imutável. 19 testes de integridade em transação desfeita. |
| F2-T04 | ✅ | Etiquetas (proposta vs revisão), evidências por multitrecho (offsets UTF-16 validados contra a versão), figura (bbox 0–1) ou passo de cálculo, taxonomia de distratores v0, revisões editoriais. Aluno não lê gabarito, resolução nem evidências (6 testes de acesso). |
| F2-T05 | ✅ | Papel de editor em `user_roles` (só SQL do dono escreve), políticas da área editorial, buckets privados `editorial` (só editor) e `pessoal` (cada conta na própria pasta). Matriz de acesso contra o projeto real com A, B, editor e visitante: 61/61 na entrega (135/135 na sessão 10) (`pnpm test:access`). Rascunho visível só ao editor, testado no banco (`docs/validation/2026-11-09-f2-t05-t11-t12.md`). |
| F2-T06 | ✅ | Enem 2025: manifesto com 90 arquivos listados, 24 baixados (D1/D2 regulares, cadernos padrão) com sha256, cor e caderno conferidos pela capa; registrados em `sources`. |
| F2-T07 | ✅ | `tools/ingest/extract.py`: Dia 1 95/95 e Dia 2 90/90 questões localizadas. Piloto de 10 com conferência visual e relatório (`docs/validation/2026-11-09-f2-t07-extracao-piloto.md`). Limitações (tabelas, alternativas em grade, texto em imagem) registradas. |
| F2-T08 | ✅ | `tools/ingest/figures.py`: imagens, vetoriais e tabelas da área da questão, ligadas à letra da alternativa. PNG a 216 dpi com bbox, página, origem e sha256. Piloto: 16 recortes, 0 cortados, conferidos visualmente. Limitações (faixa da figura vizinha, texto em imagem) ficam para a revisão F2-T12 (`docs/validation/2026-11-09-f2-t08-t09-t10.md`). |
| F2-T09 | ✅ | Contrato `item-proposal.v1` (JSON Schema) + `contract.py`: válida / dúvida / rejeitada. Conteúdo perigoso (HTML, script, `javascript:`, controle, inversão de direção) rejeitado também por `CHECK` no banco. Tabelas `item_proposals` e `doubt_queue`. Testes: 17 unitários e 15 no banco. Propostas ainda não gravadas no banco (entram com F2-T12). |
| F2-T10 | ✅ | `tools/ingest/crossmatch.py`. CD1×CD2: 95/95 conferem. CD7×CD5: 87 conferem e 3 anuladas nas duas. 0 divergências. Letras mapeadas por texto, bitmap idêntico ou comparação visual. 10 pares conferidos à mão (`docs/validation/f2-t10/`). Corrigiu 4 defeitos do extrator (largura total, fração empilhada, sinal de expoente, "Anulado"). 7 testes. |
| F2-T11 | 🟡 | `tools/ingest/tagging.py`: pedido estruturado com habilidades da área, taxonomia e gabarito oficial; JSON Schema; conferência local; qualquer incerteza deixa a sugestão pendente; proveniência (modelo pedido/servido, versão e sha256 do prompt). Tabela `tag_suggestions` imutável, só editor. 19 testes com cliente falso e 10 no banco. **Falta a rodada real:** depende da chave `RESOLVE_ANTHROPIC_API_KEY` (decisão 0004). Nenhuma sugestão real gerada. |
| F2-T12 | ✅ | `/editor` e `/editor/proposta/[id]`: página do PDF com caixas da questão e das figuras ao lado da extração; corrige texto, caixa e texto alternativo de figura; dúvidas; histórico imutável (revisão 0 = extração) com visualização de revisões anteriores; conflito entre abas. Cadernos 1 e 7 carregados (185 propostas). 9 testes no banco, 7 unitários, 6 de ponta a ponta; suíte completa 60/60. |
| F2-T13 | ✅ | Revisão de etiquetas na proposta (`/editor/proposta/[id]/etiquetas`), sem IA obrigatória (decisão 0005). Aprovar exige campos aplicáveis ou justificativa de ausência e checklist completo, conferido pelo banco; devolver abre dúvida; rejeitar marca a proposta; anulada fica fora. Gabaritos dos 12 cadernos e cruzamento no banco. 15 casos no banco, 5 unitários, ponta a ponta (`docs/validation/2026-11-09-f2-t13-t14.md`). |
| F2-T14 | ✅ | `publish_proposals` (tudo ou nada, só editor), fila com impedimentos (`/editor/publicar`), vista `study_items` sem gabarito. Publicação completa testada em transação desfeita: duas cores com letras conferidas, gabarito oculto ao aluno, rejeitada e lote de teste barrados, figura publicada legível e PDF não. Matriz de acesso 85/85. **Nenhum item publicado ainda:** depende da conferência de Guto. |

Demais F2 ⬜. F2-T15 (revisar lote de até 15 itens) liberada: é a primeira revisão humana real. F2-T17 (microdados) depende só de EXT-DADOS.

## F3 — Primeiro ciclo de estudo

| ID | Estado | Evidência / o que falta |
|---|---|---|
| F3-T01 | ✅ | Sessões, lista congelada e tentativas por funções que usam a conta do login. Mesma confirmação enviada duas vezes = uma tentativa lógica; acerto calculado no servidor; gabarito só depois; ajuda vista marca a tentativa; tempos limitados; prazo e pausa conforme o modo (`docs/validation/2026-11-09-f3-t01-t06-t12.md`). Concorrência real ainda não exercitada (proteção estrutural; teste via API quando houver questão publicada). |
| F3-T02 | 🟡 | Resolver com conteúdo real construído: `/estudar` oferece treino por área e quantidade (só publicadas e não anuladas, primeiro as não respondidas; sem publicadas, estado vazio honesto e a demonstração em `/estudar/demonstracao`); `/estudar/sessao/[id]` mostra uma questão por vez com `QuestionView`, grava antes de revelar (reenvio com a mesma ação, guardada por questão), motivo do erro opcional, resumo no fim. `session_feedback` (migração `20261110140000`) devolve gabarito só das já respondidas: banco em transação desfeita (antes de responder 0 linhas; depois, correta confere; outra conta 0). Ponta a ponta `estudo`: estado vazio e 404 de sessão alheia. **Falta:** rodar o fluxo real (responder, recarregar, resposta preservada; texto e figuras conferem) — o teste já está escrito e roda sozinho quando houver questão publicada (F2-T16). |
| F3-T03 | 🟡 | Recuperação local: a ação de cada questão fica guardada no aparelho; sem conexão (inclusive quando a ação do servidor lança erro), a resposta vai para a fila `resolve:respostas-pendentes` com a mesma ação e o resolver mostra "guardada neste aparelho"; ao reabrir a sessão e no evento `online`, reenvia em ordem; sucesso ou erro definitivo limpam, rede mantém. O banco devolve a mesma tentativa para a mesma ação (F3-T01), então não duplica. Unitários (3) da fila. **Falta:** o caso offline na tela com questão publicada (já no teste `estudo`). |
| F3-T04 | 🟡 | Raio-X textual: `item_explanation(session_item)` (migração `20261110150000`) libera habilidade, evidências, distratores aprovados, resolução e resposta **só** depois da tentativa gravada naquela questão da sessão ou de ajuda pedida (`ajuda_vista`, que marca a tentativa como feita com ajuda); antes, `{released: false}`. Banco em transação desfeita: antes de responder bloqueado; depois, H18, 1 evidência recortada certa, 4 distratores, 1 passo, resposta E; nova sessão volta a bloquear; ajuda libera e a tentativa sai com ajuda; outra conta recusada. Painel no resolver ("Ver Raio-X" depois de responder; "Pedir ajuda" com confirmação antes); evidência recortada pelo UTF-16 do próprio texto, ausência mostrada como indisponível (unitários). **Falta:** o fluxo na tela com questão publicada (já no teste `estudo`). |
| F3-T06 | ✅ | Caderno: um erro ativo por item, erro repetido atualiza a mesma entrada, motivo opcional com "não informado" explícito (taxonomia v0, decisão 0006). A interface do motivo entra na tela de resolver (F3-T02). |
| F3-T07 | ✅ | Agenda `srs-v1` (1/3/7/14/30 dias, 3 min por item no lote) alimentada pela confirmação da resposta. Relógio controlado: erro → dia local seguinte; progressão completa; ajuda repete o intervalo; acerto antecipado não conta; última etapa conclui e resolve o erro no caderno; fuso Tóquio × São Paulo e fuso inválido; fila com lote pelo tempo e restante visível; reenvio = 1 evento (`docs/validation/2026-11-09-f3-t07-f5-t02.md`, decisão 0007). Tela da revisão: F3-T08. |
| F3-T12 | ✅ | Eventos de sessão em ordem reproduzível, sem texto digitado nem rastreamento contínuo (sessão 9, `docs/validation/2026-11-09-f3-t01-t06-t12.md`). Linha acrescentada na sessão 12. |
| F3-T08 | 🟡 | `/revisar`: fila do dia vinda do banco, sem seleção manual; tempo de 15/30/60 min define o lote e o resto fica visível (das mais atrasadas às recentes); questões do lote abrem uma sessão `revisao` no mesmo resolver (resposta antes do Raio-X; a confirmação atualiza a agenda; ajuda e repetição ficam na tentativa, F3-T01/T07); cartões pedem lembrar antes do verso e gravam em `card_reviews` com reenvio seguro; sem nada vencido, mostra a próxima data. Ponta a ponta `estudo` (fila vazia, tempo, axe). **Falta:** exercitar na tela com questão publicada e com cartão publicado (lógica do banco já testada em F3-T07 e F3-T09). |
| F3-T09 | ✅ | Cartões com fonte e revisão de editor; publicado imutável (só aposenta). Erro na habilidade aprovada põe o cartão na fila; revisão em `card_reviews`, fora de `attempts`/TRI; fila do dia junta questões e cartões; tela `/editor/cartoes`. Migração `20261110110000` aplicada (sem comandos destrutivos). Banco em transação desfeita com a Q10 do caderno 1 publicada: erro → cartão na fila (dia seguinte), progressão 1/3/7/14/30, reenvio, antecipada, aposentar, isolamento; `attempts` só com os 2 erros. Matriz 186/186; ponta a ponta do editor 12/12 (`docs/validation/2026-11-10-f5-t03-t08-f3-t09.md`). Tela de revisão do aluno: F3-T08. |

Demais F3 ⬜. F3-T02 depende de F2-T16 (piloto de 30 publicado) e F1-T05. F3-T08 depende de F3-T04.

## F5 — Redação

| ID | Estado | Evidência / o que falta |
|---|---|---|
| F5-T02 | ✅ | Temas, textos motivadores, redações, versões, correções, avaliações, anotações e resultados. Rubrica oficial (5 competências × 6 níveis) extraída da matriz do Inep e conferida contra a página (`tools/ingest/rubrica.py`). Versão enviada imutável com sha256; tema só publica com fonte de direitos conferidos; avaliação C1–C5 nos degraus com total = soma; anotação dentro do texto e ausência sem trecho; faixa calibrada só com calibração. Outra conta e editor não leem texto nem arquivo. 14 grupos de casos no banco; matriz de acesso 135/135 (decisão 0007). Regras de discrepância ausentes até F5-T11. |

| F5-T03 | ✅ | Tema oficial do Enem 2025 extraído do caderno 1 (p. 20), conferido com os cadernos 2–4, figuras recortadas; carregado como **rascunho**. Revisão lado a lado em `/editor/temas` (conferir texto, corrigir texto alternativo, publicar só sem impedimentos) e leitura em `/redacao/temas`. Banco, 11/11 de ponta a ponta, axe (`docs/validation/2026-11-10-f5-t03-t08-f3-t09.md`, decisão 0008). **Publicação depende da conferência de Guto.** |
| F5-T08 | ✅ | Um trabalho por versão; reserva antes de cada etapa no orçamento global (US$5/mês, proposta do plano) e da conta; consumidor de uma etapa com conclusão, falhas, reconciliação e limite de tentativas. Concorrência real pela API: 8 envios simultâneos com saldo para 3 → 3 reservas; 10 envios da mesma versão → 1 trabalho. Consumidor em código com avaliador falso (9 testes). Matriz de acesso 166/166. Avaliador real: F5-T09 (depende da chave). |

Demais F5 ⬜. F5-T09 depende da chave da API; F5-T05 depende de F3-T03; F5-T04 (gerador editorial) liberada, mas também usa IA. F5-T01/T17 dependem de EXT-CORPUS.

## F4 — Rotina, habilidades e foco

| ID | Estado | Evidência / o que falta |
|---|---|---|
| F4-T13 | ✅ | Horários livres e compromissos semanais com fuso próprio; exceções de um dia (cancelar, mudar, avulso) que nunca alteram a regra; ocorrências no fuso de quem vê; conflito conferido no banco sobre o próximo ano (entre fusos e no horário de verão, com explicação de data e horário); desfazer também conferido. Tela `/rotina`. Banco (transação desfeita), unitários 8, ponta a ponta do projeto `rotina`, `audit:ui` 68/68, matriz 203/203 (`docs/validation/2026-11-10-f4-t13.md`, decisão 0009). Falta: medir com Guto o planejamento da semana em menos de 5 min (§11); avulso pela tela. |
| F4-T14 | ✅ | Metas diária, semanal e por área (nota-alvo escolhida pelo aluno, minutos) e planos se-então de até 60 min; editar, arquivar e restaurar (nada é apagado); uma meta ativa por tipo/área. Banco em transação desfeita (sessão 12), ponta a ponta no projeto `rotina` (3/3, inclui 360 px sem rolagem), matriz. Migração `20261110130000_metas_e_planos`. |

Demais F4 ⬜. F4-T04/T06 dependem só de F3-T12, mas precisam de questão publicada para fazer sentido (F3-T02).

## F6, F7 e E

⬜ Nenhuma iniciada.
