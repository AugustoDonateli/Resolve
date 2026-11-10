# Continuidade

Nota única: o que funciona, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

## Funciona (com dados reais)

- **Conta, perfis e papéis** (aluno, editor), políticas de acesso testadas pela matriz (`pnpm test:access`).
- **Hoje** (`/hoje`): plano do dia nos horários livres, próxima atividade, foco com tempo do servidor (pausar, voltar, retomar após recarregar, concluir), agenda com remarcação, feito hoje, ficou de fora, plano se-então, sequência.
- **Rotina** (`/rotina`): horários semanais e exceções de um dia, metas diária/semanal/por área, planos se-então, folgas e sequência.
- **Redação**: temas com textos motivadores (tema oficial 2025 em rascunho), editor com salvamento automático e recuperação, folha de 30 linhas (`folha-v1`), treino por peças, fila de correção com orçamento e reservas (consumidor testado), e o **avaliador real** (`lib/essay/claude-evaluator.ts`, SDK oficial, saída estruturada com notas, trechos conferidos no texto e os cinco elementos da intervenção).
- **Área editorial**: propostas, dúvidas, etiquetas, cartões de conceito, temas e **publicação de conteúdo conferido com etiquetas pendentes** (`/editor/publicar`).
- **Estudo pronto, aguardando questões publicadas**: sessão de treino com resposta preservada, Raio-X (mostra campos sem etiqueta como indisponíveis), caderno de erros e revisão espaçada, banco com filtros, triagem e conferência, ritmo.

## Pendências que dependem de Guto ou de algo externo

1. **Publicar as 105 questões** em `/editor/publicar` → "Conteúdo conferido, etiquetas pendentes": marcar o checklist e publicar (precisa da conta de editor do Guto; a publicação fica registrada em nome de quem confirma). Testado em transação desfeita. Destrava Estudar, Revisar, Banco, Triagem e Ritmo.
   - 80 propostas não entram: 74 com dúvida aberta (figura sem recorte, alternativa vazia, fórmula a conferir), 4 sem cruzamento conferido, 4 com gabarito ausente/anulado, 1 sem caderno; parte dos cruzamentos tem a letra E sem par.
2. **Chave `RESOLVE_ANTHROPIC_API_KEY`** e **política de IA confirmada**: a política atual (`redacao-ref-v0`) é só referência (Sonnet 4.6, 1.500 tokens de saída). Para chamadas reais, criar uma política nova com o modelo escolhido e saída suficiente (o modelo pensa antes de responder; 1.500 tokens cortam) e confirmar o teto de US$ 5/mês. Destrava correção de redação, etiquetagem e retorno do treino por peças.
3. **Tema oficial** em `/editor/temas`: conferir e publicar.

## Falta implementar (ordem sugerida pelo código atual)

1. **Worker da correção**: rodar `runOneStep` com o `ClaudeEvaluator` num processo com acesso de serviço ao banco (função agendada ou rota protegida); gravar justificativas e trechos em `essay_annotations`; regra de discrepância e terceira avaliação; tela de resultado com faixa só com calibração.
2. **Dia D (simulado)**: perfil de prova versionado, duração, ordem, cartão-resposta, retomada, encerramento, replay da sessão real, abertura com caderno.
3. **TRI e diagnóstico**: sem parâmetros oficiais dos itens no banco; a tela deve dizer "indisponível" até carregar parâmetros do Inep e conferir o cálculo com dados de referência.
4. Habilidades de prova restantes (comando primeiro com seleção de evidência, caça ao distrator), relatório semanal, Progresso com evidências reais.
5. Expansões (plano adaptativo, previsão, feed finito, dados brasileiros, incidência e fichas, tutor, texto compartilhado, meta de curso, reta final, questão do dia, redação por foto, grupos e duelos).

## Retomar por aqui

Item 1 de "Falta implementar" (worker da correção), em paralelo à publicação das questões por Guto. Ambiente local: `apps/web/.env.local` com a URL e a chave publicável do projeto; senhas das contas de teste geradas por `tools/dev/test-accounts.mjs`.
