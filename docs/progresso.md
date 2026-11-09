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
| F1-T08 | ⬜ | Capturas iniciais em `docs/validation/captures`. Falta a auditoria formal das 12 vistas (3 situações × 2 temas × 2 formatos), 768 px e zoom 200%. |
| F1-T09 | ✅ | `docs/motion/storyboard-momentos.md`. |
| F1-T10 | ⬜ | Liberada (depende de F1-T09). Protótipo CSS 3D/GSAP do envelope. |
| F1-T11 | ✅ | `/prototipos`: passagem medida em 607 ms. Esc ou novo clique terminam na etapa de destino, com foco no título. |
| F1-T12 | ⬜ | Liberada. Replay com dez eventos demonstrativos. |
| F1-T13 | ⬜ | Liberada. Exige cinco sessões de Guto por variante. |
| F1-T14 | ⛔ EXT-FOTOS | — |
| F1-T15 | ⬜ | Liberada. Quatro nós e oito referências. |
| F1-T16 | ✅ | `docs/motion/mapa-de-movimentos.md` (sete coreografias com quadros, interrupção e alternativa reduzida). |
| F1-T17 | ✅ | Hoje → foco → histórico em PC e celular. Interrupção aos 120 ms, caminho só por teclado e clique repetido verificados. Gravações em `docs/validation/recordings`. |
| F1-T18 | 🟡 | Raio-X e troca de competência prontos e gravados. Evidência e comentário ficam ligados, e o ritmo é controlado pelo aluno. Falta repetir com questão real quando F1-T05 sair do bloqueio. |

## F2–F7 e E

⬜ Nenhuma iniciada. Próximas liberadas sem dependência externa: **F2-T01** (conta pessoal; precisa de projeto Supabase), F1-T10, F1-T12, F1-T15. **F2-T02** depende de EXT-MATRIZ. **F2-T06** depende de EXT-PDF.
