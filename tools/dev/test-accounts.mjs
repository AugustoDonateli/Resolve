#!/usr/bin/env node
/**
 * Contas de teste automatizado (e2e-a@resolve.test, e2e-b@resolve.test).
 * Gera senhas novas, grava-as num arquivo local (fora do repositório) e imprime
 * o SQL com os hashes bcrypt para aplicar no Supabase (MCP execute_sql ou SQL Editor).
 * A senha em texto nunca vai para o banco nem para o repositório.
 *
 * Uso: node tools/dev/test-accounts.mjs <arquivo-env-de-saida>
 */
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const bcrypt = require("bcryptjs");
const out = process.argv[2];
if (!out) {
  console.error("Informe o arquivo de saída, ex.: node tools/dev/test-accounts.mjs /tmp/e2e.env");
  process.exit(1);
}
const pw = () => randomBytes(18).toString("base64url");
const a = pw();
const b = pw();
writeFileSync(out, `E2E_EMAIL=e2e-a@resolve.test\nE2E_PASSWORD=${a}\nE2E_EMAIL_B=e2e-b@resolve.test\nE2E_PASSWORD_B=${b}\n`);
chmodSync(out, 0o600);
const ha = bcrypt.hashSync(a, 10);
const hb = bcrypt.hashSync(b, 10);
console.log(`-- Senhas gravadas em ${out}. Aplique no projeto "resolve":
update auth.users set encrypted_password = '${ha}' where email = 'e2e-a@resolve.test';
update auth.users set encrypted_password = '${hb}' where email = 'e2e-b@resolve.test';`);
