#!/usr/bin/env node
/**
 * Matriz de acesso (F2-T05, plano §10 G6): duas contas de aluno (A, B), um editor (E) e um visitante.
 * Tenta, contra o projeto real, ler e escrever o que cada um NÃO deveria; confere também o que deveria.
 *
 * Uso: set -a; . <arquivo-env>; set +a; node tools/dev/access-matrix.mjs
 * Variáveis: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou apps/web/.env.local),
 *            E2E_EMAIL/E2E_PASSWORD, E2E_EMAIL_B/E2E_PASSWORD_B, E2E_EMAIL_EDITOR/E2E_PASSWORD_EDITOR.
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const envLocal = new URL("../../apps/web/.env.local", import.meta.url);
if (existsSync(envLocal)) {
  for (const line of readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const need = ["E2E_EMAIL", "E2E_PASSWORD", "E2E_EMAIL_B", "E2E_PASSWORD_B", "E2E_EMAIL_EDITOR", "E2E_PASSWORD_EDITOR"];
if (!URL_ || !KEY || need.some((k) => !process.env[k])) {
  console.error("Faltam variáveis: " + ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ...need].filter((k) => !process.env[k]).join(", "));
  process.exit(2);
}

const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

const results = [];
function check(who, what, ok, detail = "") {
  results.push({ who, what, ok, detail });
}
// Negado = erro de permissão/RLS ou resultado vazio. Outro erro (coluna errada, rede) reprova: não é prova de bloqueio.
const PERM = /permission denied|row-level security|not found|unauthorized|jwt/i;
const permError = (r) => Boolean(r.error) && PERM.test(r.error.message ?? "");
const denied = (r) => (r.error ? permError(r) : (Array.isArray(r.data) && r.data.length === 0) || r.data === null);
const rows = (r) => (r.error ? -1 : (r.data ?? []).length);

const A = await login(process.env.E2E_EMAIL, process.env.E2E_PASSWORD);
const B = await login(process.env.E2E_EMAIL_B, process.env.E2E_PASSWORD_B);
const E = await login(process.env.E2E_EMAIL_EDITOR, process.env.E2E_PASSWORD_EDITOR);
const V = { c: client(), id: null }; // visitante

// ── Dados pessoais ──
{
  const r = await A.c.from("user_preferences").select("user_id");
  check("A", "lê só as próprias preferências", !r.error && r.data.every((x) => x.user_id === A.id), `${rows(r)} linha(s)`);
  const u = await A.c.from("user_preferences").update({ updated_at: new Date().toISOString() }).eq("user_id", B.id).select();
  check("A", "não altera preferências de B", denied(u), u.error?.message ?? `${rows(u)} linha(s)`);
  const own = await A.c.from("profiles").select("user_id").eq("user_id", A.id);
  check("A", "lê o próprio perfil", rows(own) === 1, own.error?.message ?? `${rows(own)} linha(s)`);
  const p = await B.c.from("profiles").select("user_id").eq("user_id", A.id);
  check("B", "não lê o perfil de A", denied(p), p.error?.message ?? `${rows(p)} linha(s)`);
  const e = await E.c.from("user_preferences").select("user_id").eq("user_id", A.id);
  check("E", "editor não lê preferências de A", denied(e), `${rows(e)} linha(s)`);
  const v = await V.c.from("user_preferences").select("user_id");
  check("visitante", "não lê preferências", denied(v), v.error?.message ?? `${rows(v)} linha(s)`);
}

// ── Papel de editor ──
{
  const a = await A.c.rpc("is_editor");
  check("A", "is_editor() = falso", a.data === false, String(a.data ?? a.error?.message));
  const e = await E.c.rpc("is_editor");
  check("E", "is_editor() = verdadeiro", e.data === true, String(e.data ?? e.error?.message));
  const ins = await A.c.from("user_roles").insert({ user_id: A.id, role: "editor", granted_by: "eu mesmo" }).select();
  check("A", "não se promove a editor", permError(ins), ins.error?.message ?? "inseriu!");
  const others = await E.c.from("user_roles").select("user_id");
  check("E", "vê só o próprio papel", !others.error && others.data.every((x) => x.user_id === E.id), `${rows(others)} linha(s)`);
  const v = await V.c.rpc("is_editor");
  check("visitante", "não executa is_editor()", permError(v) || v.data === false, v.error?.message ?? String(v.data));
}

// ── Área editorial ──
const TEST_NOTE = "matriz de acesso (teste automatizado)";
let batchId, proposalId;
{
  const src = await E.c.from("sources").select("id").limit(1).single();
  let b = await E.c.from("ingest_batches").select("id").eq("notes", TEST_NOTE).maybeSingle();
  if (!b.data) b = await E.c.from("ingest_batches").insert({ source_id: src.data.id, tool: "tools/dev/access-matrix.mjs", tool_version: "1", notes: TEST_NOTE, publishable: false }).select("id").single();
  batchId = b.data?.id;
  check("E", "cria/lê lote editorial", Boolean(batchId), b.error?.message ?? "");
  let p = await E.c.from("item_proposals").select("id").eq("batch_id", batchId).maybeSingle();
  if (!p.data) {
    p = await E.c.from("item_proposals").insert({ batch_id: batchId, question_number: 180, payload: { contract: "item-proposal/v1", teste: true }, status: "duvida" }).select("id").single();
  }
  proposalId = p.data?.id;
  check("E", "cria/lê proposta", Boolean(proposalId), p.error?.message ?? "");
  const d = await E.c.from("doubt_queue").insert({ proposal_id: proposalId, kind: "teste da matriz de acesso" }).select("id").single();
  check("E", "abre dúvida", Boolean(d.data), d.error?.message ?? "");
  const rd = await E.c.from("doubt_queue").update({ status: "resolvida", resolution: "fechada pelo teste", resolved_by: E.id, resolved_at: new Date().toISOString() }).eq("id", d.data?.id).select();
  check("E", "resolve dúvida", rows(rd) === 1, rd.error?.message ?? "");
  const forged = await E.c.from("doubt_queue").insert({ proposal_id: proposalId, kind: "teste: autoria forjada" }).select("id").single();
  const fu = await E.c.from("doubt_queue").update({ status: "resolvida", resolution: "em nome de outro", resolved_by: A.id, resolved_at: new Date().toISOString() }).eq("id", forged.data?.id).select();
  check("E", "não resolve dúvida em nome de outra conta", denied(fu), fu.error?.message ?? `${rows(fu)} linha(s)`);
  await E.c.from("doubt_queue").update({ status: "descartada", resolution: "teste encerrado", resolved_by: E.id, resolved_at: new Date().toISOString() }).eq("id", forged.data?.id);

  for (const [who, s] of [["A", A], ["B", B], ["visitante", V]]) {
    for (const t of ["ingest_batches", "item_proposals", "doubt_queue"]) {
      const r = await s.c.from(t).select("id").limit(5);
      check(who, `não lê ${t}`, denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
    }
    const up = await s.c.from("item_proposals").update({ status: "valida" }).eq("id", proposalId).select();
    check(who, "não altera proposta", denied(up), up.error?.message ?? `${rows(up)} linha(s)`);
    const ins = await s.c.from("ingest_batches").insert({ source_id: (await E.c.from("sources").select("id").limit(1).single()).data.id, tool: "x", tool_version: "1" }).select();
    check(who, "não cria lote", permError(ins), ins.error?.message ?? "inseriu!");
  }
  const ann = await A.c.from("evidence_annotations").select("id").limit(1);
  check("A", "não lê evidências (gabarito comentado)", denied(ann), ann.error?.message ?? `${rows(ann)} linha(s)`);
  const ic = await A.c.from("alternatives").select("is_correct").limit(1);
  check("A", "não lê a coluna is_correct", permError(ic), ic.error?.message ?? "leu!");
  const draft = await A.c.from("item_versions").select("id").neq("review_status", "published").limit(1);
  check("A", "não lê versão de item não publicada", denied(draft), `${rows(draft)} linha(s)`);
}

// ── Revisão de etiquetas, gabaritos e publicação (F2-T13/T14) ──
{
  for (const [who, sess] of [["A", A], ["B", B], ["visitante", V]]) {
    for (const t of ["official_answer_keys", "variant_checks", "proposal_tag_reviews", "tag_suggestions", "item_proposal_revisions"]) {
      const r = await sess.c.from(t).select("*").limit(3);
      check(who, `não lê ${t}`, denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
    }
    const pub = await sess.c.rpc("publish_proposals", { p_ids: [proposalId], p_note: "tentativa" });
    check(who, "não publica", permError(pub) || /resolve_not_editor/.test(pub.error?.message ?? ""), pub.error?.message ?? "publicou!");
    const ans = await sess.c.rpc("official_answer", { p_proposal: proposalId });
    check(who, "não obtém gabarito oficial", Boolean(ans.error) || ans.data === null, ans.error?.message ?? String(ans.data));
  }
  const keys = await E.c.from("official_answer_keys").select("answer").limit(1);
  check("E", "lê gabaritos oficiais", rows(keys) === 1, keys.error?.message ?? "");
  const study = await A.c.from("study_items").select("item_version_id, alternatives");
  check("A", "lê a vista de estudo sem gabarito", !study.error && !JSON.stringify(study.data).includes("is_correct"), study.error?.message ?? `${rows(study)} item(ns)`);
  const vs = await V.c.from("study_items").select("item_version_id").limit(1);
  check("visitante", "não lê a vista de estudo", permError(vs), vs.error?.message ?? `${rows(vs)} item(ns)`);
}

// ── Arquivos ──
{
  const bytes = new Blob(["arquivo de teste da matriz de acesso"], { type: "text/plain" });
  const pathA = `${A.id}/matriz-de-acesso.txt`;
  const up = await A.c.storage.from("pessoal").upload(pathA, bytes, { upsert: true, contentType: "text/plain" });
  check("A", "envia para a própria pasta", !up.error, up.error?.message ?? "");
  const own = await A.c.storage.from("pessoal").download(pathA);
  check("A", "baixa o próprio arquivo", !own.error, own.error?.message ?? "");
  for (const [who, s] of [["B", B], ["E", E], ["visitante", V]]) {
    const dl = await s.c.storage.from("pessoal").download(pathA);
    check(who, "não baixa arquivo pessoal de A", permError(dl), dl.error?.message ?? "baixou!");
    const ls = await s.c.storage.from("pessoal").list(A.id);
    check(who, "não lista a pasta de A", denied(ls), ls.error?.message ?? `${rows(ls)} item(ns)`);
    const ow = await s.c.storage.from("pessoal").upload(pathA, new Blob(["sobrescrito"], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
    check(who, "não sobrescreve arquivo de A", permError(ow), ow.error?.message ?? "sobrescreveu!");
    const rm = await s.c.storage.from("pessoal").remove([pathA]);
    check(who, "não apaga arquivo de A", permError(rm) || (rm.data ?? []).length === 0, rm.error?.message ?? `${(rm.data ?? []).length} removido(s)`);
  }
  const still = await A.c.storage.from("pessoal").download(pathA);
  check("A", "arquivo continua intacto", !still.error && (await still.data.text()) === "arquivo de teste da matriz de acesso");
  const intoB = await A.c.storage.from("pessoal").upload(`${B.id}/intruso.txt`, bytes, { upsert: true, contentType: "text/plain" });
  check("A", "não envia para a pasta de B", permError(intoB), intoB.error?.message ?? "enviou!");

  const edPath = "teste/matriz-de-acesso.json";
  const eu = await E.c.storage.from("editorial").upload(edPath, new Blob(['{"teste":true}'], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  check("E", "envia para o bucket editorial", !eu.error, eu.error?.message ?? "");
  const ed = await E.c.storage.from("editorial").download(edPath);
  check("E", "baixa do bucket editorial", !ed.error, ed.error?.message ?? "");
  for (const [who, s] of [["A", A], ["B", B], ["visitante", V]]) {
    const dl = await s.c.storage.from("editorial").download(edPath);
    check(who, "não baixa do bucket editorial", permError(dl), dl.error?.message ?? "baixou!");
    const w = await s.c.storage.from("editorial").upload("teste/intruso.json", new Blob(["{}"], { type: "application/json" }), { upsert: true, contentType: "application/json" });
    check(who, "não envia para o bucket editorial", permError(w), w.error?.message ?? "enviou!");
    const su = await s.c.storage.from("editorial").createSignedUrl(edPath, 60);
    check(who, "não gera link assinado editorial", permError(su), su.error?.message ?? "gerou!");
  }
  await A.c.storage.from("pessoal").remove([pathA]);
}

const fail = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.who.padEnd(9)} ${r.what}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${results.length - fail.length}/${results.length} verificações passaram.`);
process.exit(fail.length ? 1 : 0);
