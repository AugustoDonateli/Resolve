# Resolve — instruções para sessões do Claude

Plataforma de preparação para o ENEM. Dono e primeiro usuário: Guto (prova em 2027).

**Pedido em vigor:** concluir a plataforma (pedido de Guto de 10/11/2026) e reconstruir a experiência na identidade Mesa (pedido de 11/11/2026, ver "Regras do produto"): os seis núcleos (questões/estudo/revisão, diagnóstico e TRI, habilidades de prova, redação completa, rotina e foco, simulado e estratégia) e as expansões (plano adaptativo, previsão, feed finito, dados brasileiros, incidência e fichas, tutor, texto compartilhado, meta de curso, reta final, questão do dia, redação por foto, grupos e duelos), com acabamento verificado. Não há backlog por ID nem ritual por tarefa; `docs/plan/Resolve-pacote.md` é só referência funcional pontual. Uma tela reformulada ou uma lista de próximos passos não encerra o pedido.

## Ao começar
1. Leia `docs/continuidade.md` (nota única: o que funciona, o que falta, ponto de retomada) e confira código e banco.
2. Continue a implementação do ponto de retomada; não reinicie pesquisa, auditoria ou planejamento.
3. Recurso que depende de algo externo (chave, dado, autorização, conteúdo): implemente o que der, marque a dependência concreta como pendente e siga para outra parte.

## Ritmo de trabalho
- **Autorização permanente de Guto (11/11/2026):** aplicar tudo direto no site principal, sem pedir que ele teste antes. Depois das verificações pertinentes (build, testes, matriz de acesso quando muda o banco), levar o trabalho à branch padrão do repositório (`claude/new-session-vhzm54`, de onde a Vercel publica) por avanço direto, e publicar conteúdo conferido contra as fontes oficiais. Registrar na nota do lote que a publicação foi autorizada por ele.
- Trabalhe em conjuntos de funcionalidades completos e incorporados ao produto (nada de app paralelo nem demos soltas), com liberdade de implementação e cuidado visual. Resolva escolhas rotineiras sozinho; pergunte só quando faltar informação que só Guto tem.
- Verificações proporcionais ao que mudou: aparência se confere no navegador; cálculos, salvamento, acesso a dados, políticas de acesso e chamadas pagas pedem os testes pertinentes. Não crie testes que repetem valores de CSS.
- Não encerre só porque uma tarefa acabou ou a conversa ficou longa. Havendo um limite real, deixe uma retomada objetiva em `docs/continuidade.md`.

## Regras do produto que não se negociam
- Banco principal só com questões oficiais conferidas. Conteúdo demonstrativo fica em `apps/web/src/lib/demo`, sempre com `<DemoBadge>`.
- Nunca invente parâmetros, notas, fontes ou estatísticas. Dado ausente aparece como indisponível. Interfaces sem dados dizem isso.
- Preserve rascunhos, respostas e dados existentes.
- Regras de prova e matriz mudam por versão; a proposta de 2028 não é regra adotada.
- Identidade **Mesa** (escolhida por Guto em 11/11/2026; substitui "Caderno de Prova"): a prova sobre a mesa. Mesa escura com luminária; o conteúdo vive em folhas de papel; tinta preta; caneta azul `#2452D1` é a ação; caneta vermelha (`correction`) é só do corretor (marcas e notas de correção); marca-texto amarelo/rosa é preenchimento com texto em tinta, nunca texto, linha ou contorno essencial. Tokens em `packages/ui`; tipos: Instrument Serif (títulos), Newsreader (leitura), DM Sans (interface), DM Mono (rótulos), Caveat (anotação curta à mão, nunca texto de leitura). Ao criar um par texto/fundo novo, acrescente-o a `usedPairs` em `packages/ui/src/tokens.ts`.
- A metáfora não pode esconder função: a navegação (divisórias de fichário no PC, abas embaixo no celular) fica sempre visível e com rótulo; todo objeto da mesa tem texto; nenhum recurso existe só atrás de animação. Traços de caneta ficam em `apps/web/src/lib/ink` e nas classes de `globals.css` (`.stamp`, `.pen-strike`, `.desk-object`, `.arrive-*`).
- Composição: cada tela tem um objetivo e uma ação principal claros. Evite grades repetidas de cartões e números.
- Movimento: tokens de `@resolve/ui/motion` e `useReduced()`. A ação é registrada antes da animação; interromper termina em estado válido; nada se move durante leitura e escrita; cenas longas podem ser puladas. Cada seção tem a sua chegada (folha que abre, ficha dada, página de agenda), sempre abaixo de 700 ms e sem bloquear cliques.

## Comandos
`pnpm dev` · `pnpm check` (lint + tipos + testes) · `pnpm build` · `pnpm --filter @resolve/web audit:ui` (auditoria visual, acessibilidade, conta, iPhone e área editorial; exige build) · `pnpm test:access` (matriz de acesso contra o projeto real) · importação: `cd tools/ingest && .venv/bin/python -m unittest test_contract test_crossmatch test_tagging`

## Supabase e testes com login
Projeto `resolve` (ref `osgajpnvhhwujfzjlfwf`). Migrações em `supabase/migrations/`, aplicadas pelo MCP. Escreva migrações sem `delete`/`drop`: o MCP pede confirmação para comandos destrutivos, e esse pedido não chega ao app (a chamada expira). Prefira desativar, renomear ou mover para `private`. Tabela nova herda privilégios padrão do Supabase, inclusive para `anon`: revogue-os na própria migração (`revoke all ... from anon`) e acrescente a tabela à matriz de acesso. Decisões em `docs/decisions/0002-conta-supabase.md`. Para a suíte `audit:ui` com login: crie `apps/web/.env.local` (veja `.env.example`), gere senhas das contas de teste (A, B e editor) com `node tools/dev/test-accounts.mjs <arquivo>` e exporte o arquivo antes de rodar. Papel de editor e área editorial: `docs/decisions/0004-papeis-editoria-e-ia.md`. Nunca use a chave de serviço no app nem no carregador; a área editorial funciona com a sessão de um editor.

## IA
Consumo controlado. A etiquetagem (`tools/ingest/tagging.py`) usa a chave própria `RESOLVE_ANTHROPIC_API_KEY` e o endereço fixo da API. Não use `ANTHROPIC_API_KEY`/`ANTHROPIC_BASE_URL` do ambiente de nuvem: são da sessão do Claude Code, não do produto. Chave da API: por último. Redações nota 1000: Guto traz depois.

## Ao encerrar
Atualize `docs/continuidade.md`, separando o que funciona, o que foi implementado mas não validado em uso real e o que falta (com o bloqueio específico). `docs/progresso.md` e `docs/handoffs/` são histórico até a sessão 12.
