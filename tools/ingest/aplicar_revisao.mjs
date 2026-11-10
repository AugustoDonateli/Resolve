// Aplica a especificação editorial com a sessão de um editor (políticas do banco valem; sem chave de serviço).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const dir = (process.env.RESOLVE_JOB_DIR ?? ".") + "/";
const env = Object.fromEntries(readFileSync(process.env.RESOLVE_EDITOR_ENV, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const web = Object.fromEntries(readFileSync(new URL("../../apps/web/.env.local", import.meta.url), "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const DRY = process.env.DRY === "1";
const job = JSON.parse(readFileSync(dir + process.argv[2], "utf8"));
const crops = Object.fromEntries([...JSON.parse(readFileSync(dir + "crops.json", "utf8")), ...JSON.parse(readFileSync(dir + "adjusted.json", "utf8"))].map((c) => [c.png, c]));
const db = createClient(web.NEXT_PUBLIC_SUPABASE_URL, web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: auth, error: le } = await db.auth.signInWithPassword({ email: (env.RESOLVE_EDITOR_EMAIL ?? env.E2E_EMAIL_EDITOR), password: (env.RESOLVE_EDITOR_PASSWORD ?? env.E2E_PASSWORD_EDITOR) });
if (le) throw le;
const WHO = `Conferência feita por Claude (assistente de IA), a pedido de Guto, contra o PDF oficial do Inep (sha256 ${job.pdf_sha.slice(0, 12)}), em 10/11/2026.`;
const { data: batch } = await db.from("ingest_batches").select("id").ilike("notes", job.booklet_note).single();
const { data: props } = await db.from("item_proposals").select("id, question_number, foreign_language, payload, current_revision, status").eq("batch_id", batch.id);
const byKey = new Map(props.map((p) => [`${p.question_number}${p.foreign_language ? "/" + p.foreign_language : ""}`, p]));
const keys = new Set([...Object.keys(job.figures), ...Object.keys(job.alt_only), ...Object.keys(job.text_fixes)]);
const log = [];
for (const key of keys) {
  const p = byKey.get(key);
  if (!p) throw new Error("proposta não encontrada: " + key);
  const pay = structuredClone(p.payload);
  const changed = new Set();
  const notes = [];
  const fig = job.figures[key];
  if (fig) {
    const c = crops[fig.crop];
    const bytes = readFileSync(dir + "figs/" + fig.crop);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== c.sha256) throw new Error("sha diferente: " + fig.crop);
    if (!DRY) {
      const up = await db.storage.from("editorial").upload(`figuras/${sha}.png`, bytes, { contentType: "image/png", upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error;
    }
    const ids = new Set((pay.figures ?? []).map((f) => f.id));
    let n = 1; while (ids.has(`fig${n}`)) n++;
    const id = `fig${n}`;
    pay.figures = [...(pay.figures ?? []), { id, kind: c.kind ?? "imagem", page: c.page, role: fig.role ?? (c.role?.startsWith("alternativa") ? "texto-base/comando" : c.role ?? "texto-base/comando"), bbox_pt: c.bbox_pt, png_sha256: sha, alt_text: fig.alt }];
    const stim = pay.stimulus_blocks ?? [];
    const at = stim.findIndex((b) => b.type === "source");
    const block = { id: `${id}b`, type: "image", asset_ref: id };
    pay.stimulus_blocks = at >= 0 ? [...stim.slice(0, at), block, ...stim.slice(at)] : [block, ...stim];
    changed.add("figures"); changed.add("stimulus_blocks");
    notes.push(`figura recortada da p. ${c.page} com texto alternativo`);
  }
  if (job.alt_only[key]) {
    pay.figures = pay.figures.map((f, i) => (i === 0 ? { ...f, alt_text: job.alt_only[key] } : f));
    changed.add("figures"); notes.push("texto alternativo da figura");
  }
  const fx = job.text_fixes[key];
  if (fx?.alternative_E) {
    pay.alternatives.E = [{ id: "ae", type: "paragraph", text: fx.alternative_E }];
    changed.add("alternatives"); notes.push("alternativa E sem o texto vizinho que a extração tinha juntado");
  }
  if (fx?.stimulus) {
    const sources = (pay.stimulus_blocks ?? []).filter((b) => b.type === "source");
    pay.stimulus_blocks = [...fx.stimulus.map((b, i) => ({ id: `s${i + 1}`, ...b })), ...sources];
    changed.add("stimulus_blocks"); notes.push("quadro reorganizado por coluna (a extração tinha intercalado as colunas)");
  }
  const note = `${notes.join("; ")}. ${WHO}`;
  if (DRY) { log.push(`${key}: ${[...changed].join(",")} | ${notes.join("; ")}`); continue; }
  const { data, error } = await db.rpc("revise_proposal", { p_id: p.id, p_expected_revision: p.current_revision, p_payload: pay, p_note: note, p_changed: [...changed] });
  if (error) throw new Error(`${key}: ${error.message}`);
  log.push(`${key}: revisão ${data[0].revision}, ${data[0].status}`);
}
// dúvidas
for (const [key, p] of byKey) {
  const { data: open } = await db.from("doubt_queue").select("id, kind").eq("proposal_id", p.id).eq("status", "aberta");
  for (const d of open ?? []) {
    let decision = null, resolution = null;
    if (d.kind.startsWith("figura") && job.figures[key]) { decision = "resolvida"; resolution = `Figura recortada do PDF oficial (p. ${crops[job.figures[key].crop].page}) e texto alternativo escrito sem revelar a resposta. ${WHO}`; }
    else if (d.kind.startsWith("figura") && job.false_positive_figures[key]) { decision = "descartada"; resolution = `Não há figura na questão. ${job.false_positive_figures[key]} ${WHO}`; }
    else if (d.kind.startsWith("índices") && job.formula_doubts[key]) { decision = "resolvida"; resolution = `${job.formula_doubts[key]} ${WHO}`; }
    if (!decision) continue;
    if (DRY) { log.push(`dúvida ${key} [${d.kind.slice(0, 30)}] → ${decision}`); continue; }
    const { error } = await db.from("doubt_queue").update({ status: decision, resolution, resolved_by: auth.user.id, resolved_at: new Date().toISOString() }).eq("id", d.id).eq("status", "aberta");
    if (error) throw new Error(`dúvida ${key}: ${error.message}`);
    const { data: st } = await db.rpc("refresh_proposal_status", { p_id: p.id });
    log.push(`dúvida ${key} → ${decision}; proposta ${st}`);
  }
}
// letras do cruzamento
const { data: booklet } = await db.from("booklets").select("id").eq("source_id", (await db.from("sources").select("id").eq("sha256", job.pdf_sha).single()).data.id).single();
for (const l of job.letters ?? []) {
  const [n, lang] = l.key.split("/");
  let q = db.from("variant_checks").select("id, letter_map").eq("base_booklet_id", booklet.id).eq("base_position", Number(n)).eq("result", "confere");
  q = lang ? q.eq("foreign_language", lang) : q.is("foreign_language", null);
  const { data: rows } = await q;
  for (const r of rows ?? []) {
    if (r.letter_map[l.letter]) { log.push(`letra ${l.key}: já preenchida`); continue; }
    if (DRY) { log.push(`letra ${l.key}: ${l.letter} → ${l.other}`); continue; }
    const { error } = await db.rpc("fill_variant_letter", { p_check: r.id, p_letter: l.letter, p_other_letter: l.other, p_note: `Alternativa ${l.letter} idêntica nas duas cores, conferida no PDF oficial: ${l.pages}. ${WHO}` });
    if (error) throw new Error(`letra ${l.key}: ${error.message}`);
    log.push(`letra ${l.key}: preenchida`);
  }
}
console.log(log.join("\n"));
