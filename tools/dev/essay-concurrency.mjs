#!/usr/bin/env node
/**
 * Concorrência da fila de correção (F5-T08, plano §10 G6), contra o projeto real, pela API e com a conta A.
 *
 * 1. Oito envios SIMULTÂNEOS de versões diferentes, com saldo da conta para apenas N etapas:
 *    só N reservas, o resto em "limite_atingido".
 * 2. Dez envios SIMULTÂNEOS da mesma versão (seis com a mesma chave, quatro com chaves diferentes):
 *    um único trabalho.
 * No fim, apaga as redações criadas (a exclusão leva versões e trabalhos; o registro de custo fica).
 *
 * Preparação (SQL do dono, antes): política temporária de orçamento para a conta A com o limite do teste.
 * Conferência e limpeza do orçamento (SQL do dono, depois): ver docs/validation/2026-11-10-f5-t03-t08-f3-t09.md.
 *
 * Uso: set -a; . <arquivo-env>; set +a; node tools/dev/essay-concurrency.mjs [vagas-esperadas=3]
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const envLocal = new URL("../../apps/web/.env.local", import.meta.url);
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const expectedSlots = Number(process.argv[2] ?? 3);
const client = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const A = client();
const { error: loginErr } = await A.auth.signInWithPassword({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
if (loginErr) throw loginErr;

const created = [];
async function draft(i) {
  const { data: e, error } = await A.from("essays").insert({}).select("id").single();
  if (error) throw error;
  created.push(e.id);
  const { data: v, error: e2 } = await A.from("essay_versions")
    .insert({ essay_id: e.id, paragraphs_json: [{ id: "p1", text: `Redação do teste de concorrência ${i}.` }] })
    .select("id")
    .single();
  if (e2) throw e2;
  return v.id;
}

const results = [];
const check = (what, ok, detail) => results.push({ what, ok, detail });
try {
  // 1) oito versões, oito envios ao mesmo tempo
  const versions = [];
  for (let i = 1; i <= 8; i++) versions.push(await draft(i));
  const t1 = Date.now();
  const r1 = await Promise.all(versions.map((v) => A.rpc("submit_essay", { p_version_id: v, p_idempotency_key: `conc-${randomUUID()}` })));
  const ms1 = Date.now() - t1;
  const errs1 = r1.filter((r) => r.error).map((r) => r.error.message);
  const st = r1.filter((r) => !r.error).map((r) => r.data[0].status);
  const queued = st.filter((s) => s === "na_fila").length;
  const limited = st.filter((s) => s === "limite_atingido").length;
  check("8 envios simultâneos sem erro", errs1.length === 0, errs1.join("; ") || `${ms1} ms`);
  check(`só ${expectedSlots} reservas cabem no saldo`, queued === expectedSlots && limited === 8 - expectedSlots, `na_fila=${queued} limite_atingido=${limited}`);

  // 2) uma versão, dez envios ao mesmo tempo (6 com a mesma chave, 4 com chaves diferentes)
  const v9 = await draft(9);
  const same = `conc-mesma-${randomUUID()}`;
  const keys = [...Array(6).fill(same), ...Array.from({ length: 4 }, () => `conc-${randomUUID()}`)];
  const r2 = await Promise.all(keys.map((k) => A.rpc("submit_essay", { p_version_id: v9, p_idempotency_key: k })));
  const errs2 = r2.filter((r) => r.error).map((r) => r.error.message);
  const ids = new Set(r2.filter((r) => !r.error).map((r) => r.data[0].job_id));
  const fresh = r2.filter((r) => !r.error && r.data[0].duplicate === false).length;
  check("10 envios simultâneos da mesma versão sem erro", errs2.length === 0, errs2.join("; "));
  check("um único trabalho para a versão", ids.size === 1 && fresh === 1, `trabalhos distintos=${ids.size}, criados=${fresh}`);

  const { data: jobs } = await A.from("essay_jobs").select("id, version_id, status").in("version_id", [...versions, v9]);
  check("trabalhos gravados = 9 (um por versão)", jobs?.length === 9, `${jobs?.length}`);
  const { data: vers } = await A.from("essay_versions").select("status").in("id", [...versions, v9]);
  check("todas as versões ficaram enviadas (texto preservado mesmo sem saldo)", vers?.every((v) => v.status === "submetida"), vers?.map((v) => v.status).join(","));
} finally {
  const { error } = await A.from("essays").delete().in("id", created);
  check("redações do teste apagadas (com versões e trabalhos)", !error, error?.message ?? `${created.length} apagada(s)`);
}

const fail = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.what}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${results.length - fail.length}/${results.length} verificações passaram.`);
process.exit(fail.length ? 1 : 0);
