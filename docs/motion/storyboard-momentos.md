# Storyboard dos três momentos principais — F1-T09

Base: plano §8 (M03, M06, passagem) e o mapa `mapa-de-movimentos.md` (F1-T16). Os três momentos usam papel, tinta, margem, bolinha e a folha azul. Nenhum logo oficial. Cada um pode ser pulado desde o primeiro quadro e tem alternativa reduzida.

## 1. Envelope e caderno (M03) — 4–6 s, protótipo em F1-T10

| Quadro | Tempo | Conteúdo | Foco/controle |
|---|---|---|---|
| Q0 | 0,0 s | Mesa de papel (fundo `background` com granulação). Envelope pardo-claro lacrado, levemente inclinado. Botões **Pular** e **Começar prova** já visíveis. | Foco em **Pular**. Cronômetro parado e "não iniciado" visível. |
| Q1 | 0,0–1,2 s | A câmera se aproxima devagar (escala 1 → 1,08). Luz lateral suave. | — |
| Q2 | 1,2–2,2 s | O lacre se rompe (duas metades giram ±8°). A aba do envelope abre em `rotateX` até 160°. | — |
| Q3 | 2,2–3,6 s | O caderno sobe do envelope (translateY), com a capa na cor do caderno sorteado entre os carregados e mapeados. | A origem real da prova aparece na capa. |
| Q4 | 3,6–5,0 s | O envelope sai do quadro para baixo. A câmera alinha a capa ao enquadramento da folha (mesma margem da tela de questão). | — |
| Q5 | 5,0 s | Estado final: capa estática, título da aplicação, **Começar prova**. | Foco em **Começar prova**. O cronômetro só inicia nessa ação. |

Interromper em qualquer quadro leva a Q5. Movimento reduzido mostra Q5 direto. Falha de mídia também mostra Q5 (capa estática). Produção final: Blender pré-renderizado (F7-T08 a T14). O protótipo F1-T10 usa planos CSS 3D/GSAP para testar enquadramento.

## 2. Passagem entre etapas — ≤ 700 ms, protótipo pronto (F1-T11)

| Quadro | Tempo | Conteúdo |
|---|---|---|
| P0 | 0 ms | Etapa atual. O título da página está em (x, y). |
| P1 | 0–300 ms | A folha azul sobe por `clip-path` com `ease.stage`. Número e título da etapa seguinte sobem 24 px e aparecem na mesma posição (x, y). |
| P2 | 300 ms | Cobertura total: a etapa troca (estado de destino passa a valer). |
| P3 | 300–600 ms | A folha sai por cima e o título da folha some 16 px para cima. A nova etapa aparece com o título no mesmo lugar. |
| P4 | 600 ms | Foco no título da nova etapa. |

Interromper (novo clique, Esc, desmontagem) mata a timeline e aplica o destino. Medido: 607 ms. Uso: entrada/saída de blocos e módulos, nunca a cada alternativa nem durante leitura ou digitação.

## 3. Replay (M06) — até 30 s, protótipo em F1-T12

| Quadro | Conteúdo | Controle |
|---|---|---|
| R0 | Cartão-resposta da sessão: grid de bolinhas preenchidas em tinta, com eventos demonstrativos identificados. | **Reproduzir resumo**, **Ver tabela** |
| R1 (0–1,5 s) | As bolinhas saem do grid e se alinham numa linha do tempo horizontal, mantendo a mesma ordem. Cada bolinha fica na sua posição temporal. | Pausar |
| R2 (1,5–25 s) | Um cursor percorre a linha com escala indicada ("1 s = 4 min"). Retornos aparecem como arcos de tinta para trás. Mudanças de resposta viram bolinha dupla. "Chute" só aparece quando declarado. | Pausar, voltar, avançar, selecionar evento |
| R3 | Selecionar um evento abre a questão correspondente. A explicação detalhada espera ação. | Voltar ao replay |
| R4 | Fim: resumo textual equivalente (tabela de eventos). | — |

Reduzido: linha do tempo final estática com a tabela. Nada afirma atenção ou fadiga: são hipóteses identificadas.
