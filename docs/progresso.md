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
| F1-T05 | ⛔ EXT-PDF | Componente de questão longa pronto com **questão demonstrativa identificada** (`/estudar`). Faltam uma questão real com figura e figura ampliável. |
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
| F2-T05 | ⬜ | Liberada (papel de editor e acesso a arquivos). |
| F2-T06 | ✅ | Enem 2025: manifesto com 90 arquivos listados, 24 baixados (D1/D2 regulares, cadernos padrão) com sha256, cor e caderno conferidos pela capa; registrados em `sources`. |
| F2-T07 | ✅ | `tools/ingest/extract.py`: Dia 1 95/95 e Dia 2 90/90 questões localizadas. Piloto de 10 com conferência visual e relatório (`docs/validation/2026-11-09-f2-t07-extracao-piloto.md`). Limitações (tabelas, alternativas em grade, texto em imagem) registradas. |
| F2-T08 | ✅ | `tools/ingest/figures.py`: imagens, vetoriais e tabelas da área da questão, ligadas à letra da alternativa. PNG a 216 dpi com bbox, página, origem e sha256. Piloto: 16 recortes, 0 cortados, conferidos visualmente. Limitações (faixa da figura vizinha, texto em imagem) ficam para a revisão F2-T12 (`docs/validation/2026-11-09-f2-t08-t09-t10.md`). |
| F2-T09 | ✅ | Contrato `item-proposal.v1` (JSON Schema) + `contract.py`: válida / dúvida / rejeitada. Conteúdo perigoso (HTML, script, `javascript:`, controle, inversão de direção) rejeitado também por `CHECK` no banco. Tabelas `item_proposals` e `doubt_queue`. Testes: 17 unitários e 15 no banco. Propostas ainda não gravadas no banco (entram com F2-T12). |
| F2-T10 | ✅ | `tools/ingest/crossmatch.py`. CD1×CD2: 95/95 conferem. CD7×CD5: 87 conferem e 3 anuladas nas duas. 0 divergências. Letras mapeadas por texto, bitmap idêntico ou comparação visual. 10 pares conferidos à mão (`docs/validation/f2-t10/`). Corrigiu 4 defeitos do extrator (largura total, fração empilhada, sinal de expoente, "Anulado"). 7 testes. |

Demais F2 ⬜. F2-T17 (microdados) depende agora só de EXT-DADOS. F2-T11 e F2-T12 liberadas.

## F3–F7 e E

⬜ Nenhuma iniciada.
