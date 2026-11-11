// Restaura espaços entre palavras nas propostas já gravadas, a partir de uma nova extração do mesmo PDF
// (extract.py com keep_blank_chars). Só troca um trecho quando ele é exatamente a junção de palavras
// consecutivas da nova extração da mesma questão; o resto do texto, figuras e revisões ficam como estão.
// Uso: RESOLVE_EDITOR_ENV=<arquivo> node corrigir_espacos.mjs <extração.json> "<filtro ilike do lote>" [DRY=1]
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
const NOTE = `Espaços entre palavras restaurados: a extração descartava o caractere de espaço do PDF e grudava palavras em linhas justificadas apertadas. Cada trecho trocado é exatamente a junção das palavras da nova extração do PDF oficial (sha256 ${ext.sha256.slice(0, 12)}). Correção feita por Claude (assistente de IA), a pedido de Guto, em ${today}.`;

const fresh = new Map();
for (const q of ext.questions) {
  const texts = [...(q.stimulus_blocks ?? []).map((b) => b.text ?? ""), q.command ?? "", ...Object.values(q.alternatives ?? {}).map((a) => (typeof a === "string" ? a : JSON.stringify(a)))];
  fresh.set(`${q.number}${q.foreign_language ? "/" + q.foreign_language : ""}`, texts.join(" ").split(/\s+/).filter(Boolean));
}

/** Troca cada token que não existe na nova extração pela sequência de palavras cuja junção é igual a ele. */
export function respace(text, words) {
  const set = new Set(words);
  let n = 0;
  const out = text.split(" ").map((t) => {
    if (!t || set.has(t) || t.length < 2) return t;
    for (let i = 0; i < words.length; i++) {
      if (!t.startsWith(words[i])) continue;
      let acc = words[i], j = i;
      while (acc.length < t.length && j + 1 < words.length && t.startsWith(acc + words[j + 1])) acc += words[++j];
      if (acc === t && j > i) { n++; return words.slice(i, j + 1).join(" "); }
    }
    return t;
  });
  return { text: out.join(" "), n };
}

const fixBlocks = (blocks, words, count) =>
  (blocks ?? []).map((b) => {
    if (typeof b.text !== "string") return b;
    const r = respace(b.text, words);
    count.n += r.n;
    return r.n ? { ...b, text: r.text } : b;
  });

const { data: batch } = await db.from("ingest_batches").select("id").ilike("notes", batchNote).single();
const { data: props } = await db.from("item_proposals").select("id, question_number, foreign_language, payload, current_revision, status").eq("batch_id", batch.id).order("question_number");
const log = [];
let total = 0;
for (const p of props) {
  const key = `${p.question_number}${p.foreign_language ? "/" + p.foreign_language : ""}`;
  const words = fresh.get(key);
  if (!words) { log.push(`${key}: sem extração`); continue; }
  const count = { n: 0 };
  const pay = structuredClone(p.payload);
  pay.stimulus_blocks = fixBlocks(pay.stimulus_blocks, words, count);
  pay.command_blocks = fixBlocks(pay.command_blocks, words, count);
  pay.alternatives = Object.fromEntries(Object.entries(pay.alternatives ?? {}).map(([k, v]) => [k, fixBlocks(v, words, count)]));
  const left = JSON.stringify([pay.stimulus_blocks, pay.command_blocks, pay.alternatives]).match(/[A-Za-zÀ-ú]{22,}/g);
  if (left) log.push(`${key}: ainda grudado → ${left.join(", ")}`);
  if (!count.n) continue;
  total += count.n;
  if (DRY) { log.push(`${key}: ${count.n} trecho(s)`); continue; }
  const changed = ["stimulus_blocks", "command_blocks", "alternatives"].filter((f) => JSON.stringify(pay[f]) !== JSON.stringify(p.payload[f]));
  const { data, error } = await db.rpc("revise_proposal", { p_id: p.id, p_expected_revision: p.current_revision, p_payload: pay, p_note: NOTE, p_changed: changed });
  if (error) throw new Error(`${key}: ${error.message}`);
  log.push(`${key}: ${count.n} trecho(s) → revisão ${data[0].revision}, ${data[0].status}`);
}
console.log(log.join("\n"));
console.log(`\n${total} trecho(s) em ${log.filter((l) => /trecho/.test(l)).length} proposta(s).`);
