# 0002 — Conta pessoal no Supabase (F2-T01)

Data: 9 nov. 2026 · Sessão 04

1. **Projeto Supabase `resolve`** (ref `osgajpnvhhwujfzjlfwf`), região `sa-east-1` (São Paulo), organização AugustoDonateli, plano gratuito. Para respeitar o limite de dois projetos ativos, o projeto **VELOCE foi pausado** a pedido de Guto (dados preservados, reativável no painel).
2. **Migrações versionadas** em `supabase/migrations/`, aplicadas pelo MCP do Supabase. O nome do arquivo segue a ordem de aplicação.
3. **(Revisto: ver item 16.)** **Cadastro fechado no banco.** O MCP não altera a configuração de Auth (`disable_signup` continua falso no painel). Por isso, um gatilho `before insert` em `auth.users` (`private.enforce_signup_allowlist`) recusa qualquer e-mail fora de `public.signup_allowlist`. A tabela tem RLS sem políticas: só o dono do banco lê ou escreve. Isso gera o aviso "RLS enabled no policy" no linter, de propósito. Recomendação para Guto: desligar também "Allow new users to sign up" no painel quando quiser fechar de vez.
4. **Convites** se dão por SQL: `insert into public.signup_allowlist (email, note) values ('...', '...');`. E-mails reais não são versionados no repositório.
5. **Perfis e preferências** nascem por gatilho no cadastro (`private.handle_new_user`) e saem em cascata com a conta. O cliente só lê e altera a própria linha (RLS com `(select auth.uid()) = user_id`). Inserir e apagar é revogado para `anon`/`authenticated`. Funções ficam no schema `private`, sem permissão de execução para clientes.
6. **Sessão** com `@supabase/ssr` e cookies: `src/proxy.ts` (convenção do Next 16) renova a sessão e redireciona quem não tem sessão para `/entrar?next=...`. O destino passa por `safeNext`, que só aceita caminhos internos. A proteção dos dados não depende do proxy: RLS no banco e verificação da sessão em cada Server Action.
7. **Login por e-mail e senha, sem confirmação de e-mail** (item 16). Não há link de retorno nem configuração de URLs no painel.
8. **Preferências:** com conta, valem as da conta. São renderizadas no servidor (sem troca visível de tema) e espelhadas no aparelho. Trocas rápidas são agrupadas (vai sempre o estado mais recente) e o formulário mostra "Salvo na conta". Sem conta (modo local), ficam só no aparelho.
9. **Modo local:** sem `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, o app abre sem login, para desenvolvimento. Em produção as duas variáveis são obrigatórias.
10. **Contas de teste** `e2e-a@resolve.test` e `e2e-b@resolve.test`: criadas por SQL (sem envio de e-mail), confirmadas, com convite. As senhas não ficam no repositório. Para gerar senhas novas: `node tools/dev/test-accounts.mjs <arquivo.env>` e aplicar o SQL impresso. A auditoria usa a A; o teste de conta usa a B.
11. **Zod 4** valida formulários e o contrato das preferências.

## Deploy na Vercel (registrado na sessão 04)

12. **Root Directory = `apps/web`** em Project Settings → Build and Deployment, com "Include files outside the root directory" ligado (padrão). A Vercel instala a partir da raiz do monorepo (pnpm workspace) e compila o app. Na raiz não há `next`, por isso o erro `NEXT_NO_VERSION` quando o Root Directory fica vazio.
13. **Variáveis** (Production e Preview): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `next.config.ts` faz o build falhar na Vercel se as duas primeiras faltarem, para o app nunca ir ao ar em modo local, sem login.
14. ~~Configurar URLs de retorno no Supabase~~ — desnecessário desde o item 16.
15. Node fixado em `22.x` (`engines`).

## Cadastro sem e-mail (pedido de Guto, sessão 04)

16. **Criar conta = e-mail + senha, conta ativa na hora.** Nenhum e-mail é enviado e nada precisa ser configurado no painel. `public.create_account(email, senha)` (security definer, executável por `anon`) valida senha (8–72), e-mail, liberação em `signup_allowlist` e duplicidade. Em seguida cria o usuário já confirmado em `auth.users`/`auth.identities`, com senha em bcrypt via `pgcrypto`, e devolve um status (`ok`, `not_allowed`, `exists`, `weak_password`, `invalid_email`, `rate_limited`). O app entra em seguida com `signInWithPassword`.
17. **O cadastro padrão do Supabase Auth fica bloqueado** (que enviaria e-mail): o gatilho `private.enforce_signup_allowlist` só aceita inserções feitas por `create_account` (variável de transação `resolve.creating_account`). Ninguém consegue criar conta não confirmada nem disparar e-mail.
18. **Limite global** de 10 tentativas de cadastro por minuto (`private.account_attempts`, sem e-mail nem IP).
19. **Risco aceito:** sem confirmação, quem souber um e-mail liberado e chegar antes pode criar a conta com ele. Hoje só o e-mail de Guto e as contas de teste estão liberados, e a conta de Guto já existe. Ao liberar novos e-mails, crie a conta logo ou avise a pessoa.
20. **Esqueci a senha:** sem e-mail, não há recuperação automática. A troca é feita pelo dono do banco (gerar o hash bcrypt localmente, como em `tools/dev/test-accounts.mjs`, e atualizar `auth.users.encrypted_password`). Uma tela "trocar senha" para quem está logado pode entrar numa tarefa futura.
21. **Liberar um e-mail:** `insert into public.signup_allowlist (email, note) values ('pessoa@exemplo.com', '...');`. Para abrir o cadastro a qualquer e-mail, basta remover a checagem de `signup_allowlist` em `create_account` (decisão de abertura ao público: EXT-PUBLICO).
