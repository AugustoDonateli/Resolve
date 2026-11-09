# Mapa de movimentos autorais — F1-T16

Fonte: plano §8 ("Direção de movimento autoral", "Coreografias específicas"). Tokens em `packages/ui/src/motion.ts` e `tokens.css`.

**Linguagem comum.** Os objetos da identidade A são os atores: folha, margem, aba, marca-texto, bolinha de alternativa, cartão e tinta. Toda sequência mantém uma relação visível entre o objeto acionado e o resultado. Há uma sequência coordenada por vez. Leitura e escrita ficam estáveis depois dela.

**Regras para todas as sequências**
- A ação é registrada no clique, e a animação só a acompanha. Interromper nunca desfaz nem atrasa o registro.
- Movimento reduzido = preferência do sistema **ou** opção "Reduzir movimento" (`useReduced()`). Nesse modo, durações viram 0 e o estado final aparece direto. Fade ≤ 100 ms só onde não atrapalha.
- Cores: amarelo e rosa só como preenchimento. Traços e fios usam tinta ou `link-focus`.
- Texto animado por escala só durante o trajeto. O quadro final sempre tem texto nítido, e os filhos do cartão usam `layout="position"` para não distorcer.

| # | Contexto | Gatilho | Origem → destino | Trajetória e tempos | Interrupção | Reduzido | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Hoje → Começar foco | Botão **Começar** no cartão (ou em "Depois") | Cartão do bloco → tela de foco em tela cheia | `layoutId` compartilhado (cartão, faixa, título, duração), 520 ms `ease.layout`. A agenda recua (opacidade 0,5, escala 0,985) e o fundo cobre em 260 ms. A faixa azul do cartão vira a margem da folha. O conteúdo novo entra com 220–260 ms de atraso. Total ≤ 650 ms. | Encerrar durante a abertura redireciona a animação ao histórico, e a conclusão é registrada. Clique repetido não abre dois focos. | Troca imediata. O foco vai para o título. | **Protótipo pronto** (F1-T17) |
| 2 | Encerrar bloco | **Encerrar bloco** | Tela de foco → linha no "Concluídos hoje" | Mesmo `layoutId` no sentido inverso, 520 ms. O conteúdo sai em 100 ms e o fundo sai em 260 ms (atraso de 120 ms). O registro mostra hora real de início/fim e tempo ativo. | Registro já salvo. Foco segue para **Começar** do próximo bloco. | Troca imediata | **Protótipo pronto** (F1-T17) |
| 3 | Questão → Ver Raio-X | **Ver Raio-X** e cada **Próxima etapa** | Botão → margem de anotações / trechos | Marca-texto corre da esquerda (`--sweep` 0→1, 520 ms `ease.evidence`). Um fio de 32 px cresce da borda do texto (400 ms) e a nota desliza 16 px da esquerda. As notas se reposicionam em 260 ms. A bolinha confirmada não se move. | Etapas cumulativas; **Mostrar tudo** vai ao fim. Fora da tela, oferece **Ir ao trecho** (sem rolagem automática). | Marcas e notas no estado final | **Protótipo pronto** (F1-T18, questão demonstrativa) |
| 4 | Trocar competência na correção | Aba C1–C5 | Aba → trecho → comentário | O indicador amarelo da aba desliza (`layoutId`, 180 ms). O traço azul à mão é desenhado sob cada linha do trecho em sequência (`pathLength`, 520 ms no total). O rosa preenche o trecho. O comentário nasce na margem (PC) ou abaixo do parágrafo (celular). | **Ir ao trecho** quando fora da tela. **Próxima anotação** troca uma por vez. | Traço e comentário prontos | **Protótipo pronto** (F1-T06/T18) |
| 5 | Reorganizar agenda | Arrastar bloco ou **Remarcar** (formulário) | Posição solta (ou atual) → horário escolhido | Durante o arraste, o espaço de destino aparece tracejado com o horário. Ao soltar, o bloco se assenta a partir de onde foi solto (260 ms `ease.layout`), e o horário do rótulo acompanha. Colisão: volta à origem com mensagem. | O formulário produz o mesmo resultado (`canPlace`). Compromisso fixo não se move. | Assenta sem trajeto | **Protótipo pronto** (F1-T07). Refinamento em F6-T12 |
| 6 | Alternar visualização | Abas/indicadores | Aba anterior → aba nova | O indicador conserva continuidade (`layoutId`, 180 ms). Eixos, títulos e legendas ficam parados, e só os dados animam. | Valor final disponível imediatamente | Indicador salta | Aplicado na navegação e nas competências. Gráficos: F3/F4 |
| 7 | Alternativas e controles | Toque/teclado | Bolinha vazia → preenchida | A tinta preenche a bolinha a partir do centro (120 ms `ease.press`). O botão desce 1 px ao pressionar. | Geometria e texto não mudam, e a faixa de status tem largura reservada | Sem escala | **Pronto** (F1-T03) |

## Três momentos principais na mesma linguagem

- **Passagem entre etapas:** a folha azul (`primary`) cobre a tela de baixo para cima e revela a etapa por cima. Número em Newsreader e título no mesmo lugar do título da página. Duração de 600 ms, ≤ 700. Protótipo pronto (F1-T11).
- **Envelope/caderno 3D:** papel, lacre e capa. A câmera se aproxima até a capa ocupar o enquadramento da folha de prova. Ver `storyboard-momentos.md`.
- **Replay:** as bolinhas do cartão-resposta saem do grid e se alinham numa linha do tempo, mantendo a correspondência. Ver storyboard.

## Pendências de acabamento conhecidas

- Encerrar: o título passa de 22 px (foco) para 16 px (histórico) por escala, com leve distorção durante 520 ms. O quadro final fica nítido. Avaliar em F6-T13 se vale um crossfade de rótulo.
- Raio-X no PC: a etapa "Evidência" pode cair fora da tela se o aluno estiver nas alternativas. Hoje oferecemos **Ir ao trecho**. Avaliar em F6-T11 uma miniatura do trecho no painel do scanner.
- Fonte do título da folha de passagem = `t-screen`. Conferir em telas com o título em duas linhas.
