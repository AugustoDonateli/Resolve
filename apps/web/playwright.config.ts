import { defineConfig } from "@playwright/test";

/**
 * Auditoria visual e de acessibilidade (F1-T08, G4).
 * Roda contra o build de produção: `pnpm build && pnpm audit:ui`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [["list"], ["json", { outputFile: "test-results/audit.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    deviceScaleFactor: 1,
  },
  projects: [
    { name: "sessao", testMatch: /auth\.setup\.ts/ },
    { name: "auditoria", testMatch: /audit\.spec\.ts/, dependencies: ["sessao"] },
    { name: "conta", testMatch: /auth\.spec\.ts/ },
    { name: "iphone", testMatch: /iphone\.spec\.ts/, dependencies: ["sessao"] },
    { name: "editor", testMatch: /editor\.spec\.ts/ },
  ],
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100/hoje",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
