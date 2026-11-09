# 0001 — Decisões da fundação (F1)

Data: 9 nov. 2026 · Sessão 01

1. **Versões fixadas** (exatas em `package.json`): Next.js 16.4.5, React 19.3.1, Tailwind 4.3.5, Motion 14.10.1, GSAP 3.15.1, Radix (radio-group, tabs, dialog), lucide-react, Vitest 5.1, Playwright 1.63 (mesma versão do Chromium pré-instalado) e @axe-core/playwright.
2. **TypeScript 5.9.3, não 7.x.** O typescript-eslint suporta `<6.1`, e o TS 7 (port nativo) não expõe a API JS usada pelas ferramentas. Revisitar quando o ecossistema suportar.
3. **Componentes React em `apps/web/src/components` por enquanto.** O plano sugere `packages/ui` para tokens e componentes. Ficaram em `packages/ui` os tokens (cores, tipografia, movimento), o contraste e as curvas, que são a fonte única. Os componentes migram quando houver um segundo consumidor. Isso evita configurar peer deps e build de pacote antes da hora.
4. **`packages/domain` e `packages/tri` ainda não existem.** Nascem nas tarefas que têm conteúdo real (F3-T01 e F2-T20), para não criar pacotes vazios.
5. **Fontes auto-hospedadas via @fontsource** (DM Sans 400/500/600, Newsreader 500), só com os pesos usados. Os subconjuntos são carregados por `unicode-range`. Medir os 160 KB iniciais em F6-T03.
6. **Preferências em `localStorage` até F2-T01.** Script inline antes da pintura evita troca visível de tema. Redução de movimento = sistema OU opção interna, aplicada a Motion (`MotionConfig`) e às sequências via `useReduced()`.
7. **Conteúdo demonstrativo.** Sem EXT-PDF, os protótipos usam uma questão, uma redação e uma correção **escritas para o protótipo**, sempre com selo de demonstração e sem estatísticas inventadas. O passo "Brasil" do Raio-X declara o dado indisponível em vez de estimar. Esse conteúdo vive em `apps/web/src/lib/demo` e nunca entra no banco.
8. **Breakpoints:** `sm` 640, `md` 960, `lg` 1200 (§6). Lateral do PC a partir de 960 px. Tablet usa a navegação inferior.
9. **Traços essenciais** (traço de correção, linha de agora, foco) usam `link-focus` (#2452D1 claro / #9FB7FF escuro), porque `primary` sobre o painel escuro não chega a 3:1.
