# Continuidade

Nota única: o que funciona, o que falta e onde retomar. Objetivo em vigor: concluir a plataforma inteira (ver `CLAUDE.md`).

## Funciona (com dados reais)

- **Conta, perfis e papéis** (aluno, editor), políticas de acesso testadas pela matriz (`pnpm test:access`).
- **Hoje** (`/hoje`): plano do dia nos horários livres, próxima atividade, foco com tempo do servidor (pausar, voltar, retomar após recarregar, concluir), agenda com remarcação, feito hoje, ficou de fora, plano se-então, sequência.
- **Rotina** (`/rotina`): horários semanais e exceções de um dia, metas diária/semanal/por área, planos se-então, folgas e sequência.
- **Redação**: temas com textos motivadores (tema oficial 2025 em rascunho), editor com salvamento automático e recuperação, folha de 30 linhas (`folha-v1`), treino por peças, **envio para correção** (versão congela), **correção em etapas** A → B → regra de discrepância (`discrepancia-plano-v1`: >100 no total ou >80 numa competência; fonte oficial do Inep pendente) → C quando necessário, resultado como divergência entre avaliações ("não calibrado"), comentários ancorados ao trecho com traço de caneta, cinco elementos da intervenção, **reescrita e evolução** por versão.
  - Serviço: Edge Function `corrigir-redacao` (implantada) + núcleo `supabase/functions/_shared/essay-core.ts` (testado no app com avaliador de teste) + funções `worker_*` só para `service_role` + agenda a cada 5 min (pg_cron) que só chama com fila. Sem a chave, a função responde "pendente" e não pega trabalho.
  - A conta de teste A pode ter uma correção feita pelo **avaliador de teste** (marcada na tela como teste, zero tokens). Nenhuma correção real foi feita.
- **Progresso** (`/progresso`): relatório dos últimos 7 dias (minutos feitos pelo foco × planejados, blocos, respostas, revisões, redações, por área e meta semanal), tabela equivalente; mapa de habilidades e TRI declarados como indisponíveis, com o motivo.
- **Área editorial**: propostas, dúvidas, etiquetas, cartões de conceito, temas e **publicação de conteúdo conferido com etiquetas pendentes** (`/editor/publicar`).
- **Estudo pronto, aguardando questões publicadas**: sessão de treino com resposta preservada, Raio-X (mostra campos sem etiqueta como indisponíveis), caderno de erros e revisão espaçada, banco com filtros, triagem e conferência, ritmo.

## Dia D implementado localmente

- `/estudar/dia-d` usa os perfis versionados e a ordem e as letras do caderno oficial. O catálogo exige todas as posições válidas publicadas e, no primeiro dia, o tema de redação da aplicação. As posições oficialmente anuladas nos cadernos 5 (Amarelo) e 7 (Azul) de 2025 são mantidas no cartão e excluídas dos acertos.
- O relógio do servidor começa com **Começar prova**. É possível treinar em horário livre ou fazer o ensaio às 13h30 de Brasília com o perfil regular de 2025, conforme o [Edital Inep 52/2025, §9.4](https://download.inep.gov.br/enem/edital_52_de_23_de_maio_de_2025.pdf).
- Retomada, marcações e cartão são guardados por conta. A entrega trava o cartão e a redação salva. O resultado usa apenas o cartão para contar acertos, mostra os eventos reais no replay e indica TRI e correção da redação como indisponíveis.
- A abertura usa a cena 3D existente, com capa do caderno selecionado e opção de pular. A mídia autoral final e o ensaio real de duração integral ainda estão pendentes.
- Validação local em PostgreSQL e no Edge com largura de celular. Foram exercitados prazo acelerado, isolamento por conta, retomada após recarregar, entrega idempotente, gabarito oculto até encerrar, acertos pelo cartão, replay e salvamento automático da redação. A validação com um caderno real depende da migração e da conferência editorial no projeto.

## Pendências que dependem de Guto ou de algo externo

1. **Publicar as 105 questões** em `/editor/publicar` → "Conteúdo conferido, etiquetas pendentes": marcar o checklist e publicar (precisa da conta de editor do Guto; a publicação fica registrada em nome de quem confirma). Testado em transação desfeita. Destrava Estudar, Revisar, Banco, Triagem e Ritmo.
   - 80 propostas não entram: 74 com dúvida aberta (figura sem recorte, alternativa vazia, fórmula a conferir), 4 sem cruzamento conferido, 4 com gabarito ausente/anulado, 1 sem caderno; parte dos cruzamentos tem a letra E sem par.
2. **Chave `RESOLVE_ANTHROPIC_API_KEY`** como segredo da Edge Function `corrigir-redacao` (Supabase → Edge Functions → Secrets) e **política de IA confirmada**: a política atual (`redacao-ref-v0`) é só referência (Sonnet 4.6, 1.500 tokens de saída). Para chamadas reais, criar uma política nova com o modelo escolhido e saída suficiente (o modelo pensa antes de responder; 1.500 tokens cortam) e confirmar o teto de US$ 5/mês. Destrava correção de redação, etiquetagem e retorno do treino por peças.
3. **Tema oficial** em `/editor/temas`: conferir e publicar.

## Falta implementar (ordem sugerida pelo código atual)

1. Redação restante: calibração (precisa de redações com nota humana, que Guto traz), banco de repertório, biblioteca nota 1000 com anotações e camadas (conteúdo de Guto), trilha Redação do zero, retorno do treino por peças (IA).
2. **Dia D (simulado)**. Aplicar a migração `20261111120000_dia_d.sql` no projeto Resolve e conferir a disponibilidade por caderno. Completar a conferência e publicação dos itens válidos que faltarem e publicar o tema oficial para liberar o primeiro dia. Fazer o ensaio integral e concluir o acabamento da abertura e do replay.
3. **TRI e diagnóstico**: sem parâmetros oficiais dos itens no banco; a tela deve dizer "indisponível" até carregar parâmetros do Inep e conferir o cálculo com dados de referência.
4. Habilidades de prova restantes (comando primeiro com seleção de evidência, caça ao distrator); mapa de habilidades real quando houver tentativas.
5. Expansões (plano adaptativo, previsão, feed finito, dados brasileiros, incidência e fichas, tutor, texto compartilhado, meta de curso, reta final, questão do dia, redação por foto, grupos e duelos).

## Retomar por aqui

Validar o Dia D no projeto Resolve após aplicar a migração e completar ao menos um caderno. Seguir com os itens 3 e 4 enquanto a conferência editorial avança. O ambiente local usa `apps/web/.env.local` com a URL e a chave publicável do projeto. As senhas das contas de teste são geradas por `tools/dev/test-accounts.mjs`.
