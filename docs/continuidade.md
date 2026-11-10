# Continuidade

Nota única: o que funciona, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

## Funciona (com dados reais)

- **Conta, perfis e papéis** (aluno, editor), políticas de acesso testadas pela matriz (`pnpm test:access`).
- **Hoje** (`/hoje`): plano do dia nos horários livres, próxima atividade, foco com tempo do servidor (pausar, voltar, retomar após recarregar, concluir), agenda com remarcação, feito hoje, ficou de fora, plano se-então, sequência.
- **Rotina** (`/rotina`): horários semanais e exceções de um dia, metas diária/semanal/por área, planos se-então, folgas e sequência.
- **Redação**: temas com textos motivadores (tema oficial 2025 em rascunho), editor com salvamento automático e recuperação, folha de 30 linhas (`folha-v1`), treino por peças, **envio para correção** (versão congela), **correção em etapas** A → B → regra de discrepância (`discrepancia-plano-v1`: >100 no total ou >80 numa competência; fonte oficial do Inep pendente) → C quando necessário, resultado como divergência entre avaliações ("não calibrado"), comentários ancorados ao trecho com traço de caneta, cinco elementos da intervenção, **reescrita e evolução** por versão.
  - Serviço: Edge Function `corrigir-redacao` (implantada) + núcleo `supabase/functions/_shared/essay-core.ts` (testado no app com avaliador de teste) + funções `worker_*` só para `service_role` + agenda a cada 5 min (pg_cron) que só chama com fila. Sem a chave, a função responde "pendente" e não pega trabalho.
  - A conta de teste A pode ter uma correção feita pelo **avaliador de teste** (marcada na tela como teste, zero tokens). Nenhuma correção real foi feita.
- **Área editorial**: propostas, dúvidas, etiquetas, cartões de conceito, temas e **publicação de conteúdo conferido com etiquetas pendentes** (`/editor/publicar`).
- **Estudo pronto, aguardando questões publicadas**: sessão de treino com resposta preservada, Raio-X (mostra campos sem etiqueta como indisponíveis), caderno de erros e revisão espaçada, banco com filtros, triagem e conferência, ritmo.

## Pendências que dependem de Guto ou de algo externo

1. **Publicar as 105 questões** em `/editor/publicar` → "Conteúdo conferido, etiquetas pendentes": marcar o checklist e publicar (precisa da conta de editor do Guto; a publicação fica registrada em nome de quem confirma). Testado em transação desfeita. Destrava Estudar, Revisar, Banco, Triagem e Ritmo.
   - 80 propostas não entram: 74 com dúvida aberta (figura sem recorte, alternativa vazia, fórmula a conferir), 4 sem cruzamento conferido, 4 com gabarito ausente/anulado, 1 sem caderno; parte dos cruzamentos tem a letra E sem par.
2. **Chave `RESOLVE_ANTHROPIC_API_KEY`** como segredo da Edge Function `corrigir-redacao` (Supabase → Edge Functions → Secrets) e **política de IA confirmada**: a política atual (`redacao-ref-v0`) é só referência (Sonnet 4.6, 1.500 tokens de saída). Para chamadas reais, criar uma política nova com o modelo escolhido e saída suficiente (o modelo pensa antes de responder; 1.500 tokens cortam) e confirmar o teto de US$ 5/mês. Destrava correção de redação, etiquetagem e retorno do treino por peças.
3. **Tema oficial** em `/editor/temas`: conferir e publicar.

## Falta implementar (ordem sugerida pelo código atual)

1. Redação restante: calibração (precisa de redações com nota humana, que Guto traz), banco de repertório, biblioteca nota 1000 com anotações e camadas (conteúdo de Guto), trilha Redação do zero, retorno do treino por peças (IA).
2. **Dia D (simulado)**: perfil de prova versionado, duração, ordem, cartão-resposta, retomada, encerramento, replay da sessão real, abertura com caderno.
3. **TRI e diagnóstico**: sem parâmetros oficiais dos itens no banco; a tela deve dizer "indisponível" até carregar parâmetros do Inep e conferir o cálculo com dados de referência.
4. Habilidades de prova restantes (comando primeiro com seleção de evidência, caça ao distrator), relatório semanal, Progresso com evidências reais.
5. Expansões (plano adaptativo, previsão, feed finito, dados brasileiros, incidência e fichas, tutor, texto compartilhado, meta de curso, reta final, questão do dia, redação por foto, grupos e duelos).

## Retomar por aqui

Itens 2 a 4 de "Falta implementar" (Dia D, TRI/diagnóstico honesto, habilidades de prova e relatório semanal), em paralelo às pendências de Guto. Ambiente local: `apps/web/.env.local` com a URL e a chave publicável do projeto; senhas das contas de teste geradas por `tools/dev/test-accounts.mjs`.
