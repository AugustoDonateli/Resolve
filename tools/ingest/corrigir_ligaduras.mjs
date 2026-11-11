// Corrige a ligadura duplicada ("especifificação" → "especificação", "conflflito" → "conflito") nas propostas
// gravadas antes da correção do extrator. Só troca a palavra se a forma corrigida existe na nova extração
// da mesma questão. Uso: RESOLVE_EDITOR_ENV=<arquivo> node corrigir_ligaduras.mjs <extração.json> "<filtro do lote>" [DRY=1]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const read = (p) => Object.fromEntries(readFileSync(p, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const env = read(process.env.RESOLVE_EDITOR_ENV);
const web = read(new URL("../../apps/web/.env.local", import.meta.url));
const DRY = process.env.DRY === "1";
const [extPath, batchNote] = process.argv.slice(2);
const ext = JSON.parse(readFileSync(extPath, "utf8"));
const db = createClient(web.NEXT_PUBLIC_SUPABASE_URL, web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: le } = await db.auth.signInWithPassword({ email: env.RESOLVE_EDITOR_EMAIL ?? env.E2E_EMAIL_EDITOR, password: env.RESOLVE_EDITOR_PASSWORD ?? env.E2E_PASSWORD_EDITOR });
if (le) throw le;
const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
const NOTE = `Ligadura duplicada corrigida ("fifi" → "fi", "flfl" → "fl"): o PDF repete o caractere da ligadura na mesma posição. Cada palavra corrigida confere com a nova extração do PDF oficial (sha256 ${ext.sha256.slice(0, 12)}). Feito por Claude (assistente de IA), a pedido de Guto, em ${today}.`;
const words = new Map();
for (const q of ext.questions) {
  const t = JSON.stringify([q.stimulus_blocks, q.command, q.alternatives]);
  words.set(`${q.number}${q.foreign_language ? "/" + q.foreign_language : ""}`, new Set(t.match(/[\p{L}]+/gu) ?? []));
}
const RX = /[\p{L}]*(?:fifi|flfl)[\p{L}]*/gu;
const { data: batch } = await db.from("ingest_batches").select("id").ilike("notes", batchNote).single();
const { data: props } = await db.from("item_proposals").select("id, question_number, foreign_language, payload, current_revision").eq("batch_id", batch.id).order("question_number");
const log = []; let total = 0, missing = [];
for (const p of props) {
  const key = `${p.question_number}${p.foreign_language ? "/" + p.foreign_language : ""}`;
  const ok = words.get(key) ?? new Set();
  let n = 0;
  const fix = (t) => t.replace(RX, (w) => { const c = w.replace(/fifi/g, "fi").replace(/flfl/g, "fl"); if (ok.has(c)) { n++; return c; } missing.push(`${key}:${w}`); return w; });
  const blocks = (bs) => (bs ?? []).map((b) => (typeof b.text === "string" ? { ...b, text: fix(b.text) } : b));
  const pay = { ...p.payload, stimulus_blocks: blocks(p.payload.stimulus_blocks), command_blocks: blocks(p.payload.command_blocks),
    alternatives: Object.fromEntries(Object.entries(p.payload.alternatives ?? {}).map(([k, v]) => [k, blocks(v)])) };
  if (!n) continue;
  total += n;
  if (DRY) { log.push(`${key}: ${n}`); continue; }
  const changed = ["stimulus_blocks", "command_blocks", "alternatives"].filter((f) => JSON.stringify(pay[f]) !== JSON.stringify(p.payload[f]));
  const { data, error } = await db.rpc("revise_proposal", { p_id: p.id, p_expected_revision: p.current_revision, p_payload: pay, p_note: NOTE, p_changed: changed });
  if (error) throw new Error(`${key}: ${error.message}`);
  log.push(`${key}: ${n} → revisão ${data[0].revision}, ${data[0].status}`);
}
console.log(log.join("\n"));
console.log(`\n${total} palavra(s) em ${log.length} proposta(s); sem confirmação: ${missing.join(", ") || "nenhuma"}`);
