# Continuidade

Nota única de continuidade (substitui `progresso.md` e `handoffs/`, que ficam como histórico até a sessão 12).

## Estado em 10/11/2026 (sessão 13)

- **Hoje (`/hoje`) usa dados reais.** Plano do dia, próxima atividade em destaque, foco com o relógio do servidor (tela cheia que nasce do cartão; pausar, voltar para Hoje sem encerrar, retomar depois de recarregar, concluir), agenda com remarcação, "Feito hoje", "Ficou de fora" e o plano se-então ativo. Sem horários livres, a tela leva à Rotina; sem plano, oferece "Montar plano de hoje". `demoDay()` segue em `lib/demo/routine.ts` só para os testes de `canPlace`.
- **Rotina (`/rotina`) é planejar a semana:** próximos 7 dias em lista pautada, "Toda semana" ao lado; metas e planos se-então em duas colunas; sequência no fim. `day-plan.tsx` e `focus-block.tsx` saíram (substituídos por Hoje).
- **Identidade:** título de tela em Newsreader (`t-title`), rótulos em versalete (`t-kicker`), linha sob o cabeçalho; anel de foco não aparece mais em títulos focados por script.
- **Defeito corrigido:** bloco planejado que já começou aparecia cortado na agenda e a remarcação calculava com menos minutos do que o servidor conferia.
- Verificado: `pnpm check` (88 + 7), e2e `rotina` (5/5, com o plano e o foco agora em `/hoje`), `auditoria` e `iphone` da vista Hoje (16 + fluxo por toque), capturas em 1440/390 px, claro e escuro.

## Pendências reais

1. **Publicar questões (decisão de Guto).** Banco: 0 itens publicados; 188 propostas (114 válidas, 74 em dúvida); tema de redação em rascunho. Guto já conferiu os PDFs. A aprovação de etiquetas exige habilidade, distratores e resolução (ou justificativa) e checklist. Falta escolher: publicar o piloto com esses campos marcados como indisponíveis (justificativa padrão) ou esperar a etiquetagem por IA (exige `RESOLVE_ANTHROPIC_API_KEY`). Isso destrava Estudar, Raio-X, Revisar, triagem e ritmo, que já estão prontos.
2. Tema oficial em `/editor/temas`: conferir e publicar (Guto).
3. Chave da API e confirmação do limite de US$ 5/mês.
4. O fluxo por toque do iPhone é pulado quando a conta A está sem plano (os testes de rotina limpam a conta); o fluxo completo está em `rotina.spec`.

## Próximos passos prováveis

- Estudar/Revisar/Progresso: estados vazios mais úteis enquanto não há questões (hoje são um cartão solto).
- Redação: correção ainda é demonstrativa em `/redacao`; levar a composição da folha e da correção para o fluxo real de "Minhas redações".
- Movimentos marcantes (abertura, passagem entre etapas, replay) quando o fluxo de estudo real estiver publicado.
