# Resolve — instruções para sessões do Claude

Plataforma de preparação para o ENEM. Dono e primeiro usuário: Guto. Especificação completa: `docs/plan/Resolve-pacote.md` (plano na Parte A, backlog de 182 tarefas na Parte B).

## Ao começar
1. Leia `docs/progresso.md` e o handoff mais recente em `docs/handoffs/`.
2. Escolha a próxima tarefa liberada (dependências no backlog). Tarefas de até 4 h. Se for maior, divida com sufixo A/B e registre.
3. Não reconstrua o planejamento. Não marque como concluído um teste que não rodou.

## Regras do produto que não se negociam
- Banco principal só com questões reais conferidas. Conteúdo demonstrativo fica em `apps/web/src/lib/demo`, sempre com `<DemoBadge>`.
- Nunca invente parâmetros, notas, fontes ou estatísticas. Dado ausente aparece como indisponível.
- Identidade Caderno de Prova: só os tokens de `packages/ui`. Amarelo/rosa são preenchimento com texto em tinta, nunca texto, linha ou contorno essencial. O escuro deriva da tinta.
- Movimento (§8): use os tokens de `@resolve/ui/motion` e `useReduced()`. A ação é registrada antes da animação. Interromper sempre termina em estado válido. Nada se move durante leitura e escrita.
- Ao criar um par de cores texto/fundo novo, acrescente-o a `usedPairs` em `packages/ui/src/tokens.ts`.

## Comandos
`pnpm dev` · `pnpm check` (lint + tipos + testes) · `pnpm build` · `pnpm --filter @resolve/web audit:ui` (auditoria visual e de acessibilidade; exige build)

## Ao encerrar
Atualize `docs/progresso.md` e crie `docs/handoffs/AAAA-MM-DD-sessao-NN.md` com IDs concluídos, arquivos, verificações, pendências e o próximo ID liberado.
