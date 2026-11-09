# Resolve

Preparação para o ENEM. Identidade visual: Caderno de Prova.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # URL e chave publicável do Supabase
pnpm dev        # http://localhost:3000
pnpm check      # lint, tipos e testes
```

Estrutura: `apps/web` (Next.js), `packages/ui` (tokens de cor, tipografia e movimento), `docs/` (plano, progresso, decisões, validação e handoffs).

Sem `.env.local`, o app roda em modo local (sem login). Estado atual: F1 (identidade e protótipos) e conta pessoal (F2-T01). Ver `docs/progresso.md`.
