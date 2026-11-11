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
const WHO = `Conferência feita por Claude (assistente de IA), a pedido de Guto, contra o PDF oficial do Inep (sha256 ${job.pdf_sha.slice(0, 12)}), em ${job.date ?? "10/11/2026"}.`;
const { data: batch } = await db.from("ingest_batches").select("id").ilike("notes", job.booklet_note).single();
const { data: props } = await db.from("item_proposals").select("id, question_number, foreign_language, payload, current_revision, status").eq("batch_id", batch.id);
const byKey = new Map(props.map((p) => [`${p.question_number}${p.foreign_language ? "/" + p.foreign_language : ""}`, p]));
const keys = new Set([...Object.keys(job.figures), ...Object.keys(job.alt_only), ...Object.keys(job.text_fixes), ...Object.keys(job.tables ?? {}), ...Object.keys(job.block_fixes ?? {}), ...Object.keys(job.replacements ?? {})]);
const log = [];
for (const key of keys) {
  const p = byKey.get(key);
  if (!p) throw new Error("proposta não encontrada: " + key);
  const pay = structuredClone(p.payload);
  const changed = new Set();
  const notes = [];
  const figList = job.figures[key] ? (Array.isArray(job.figures[key]) ? job.figures[key] : [job.figures[key]]) : [];
  let figAt = 0;
  for (const fig of figList) {
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
    const role = fig.alternative ? `alternativa ${fig.alternative}` : "texto-base/comando";
    pay.figures = [...(pay.figures ?? []), { id, kind: c.kind ?? "imagem", page: c.page, role, bbox_pt: c.bbox_pt, png_sha256: sha, alt_text: fig.alt }];
    if (fig.alternative) {
      // A alternativa é a própria figura: substitui o conteúdo (vazio ou só imagem trocada) pela figura nova.
      pay.alternatives = { ...pay.alternatives, [fig.alternative]: [{ id: `a${fig.alternative.toLowerCase()}img`, type: "image", asset_ref: id }] };
      changed.add("alternatives");
      notes.push(`alternativa ${fig.alternative} como figura recortada da p. ${c.page}`);
    } else {
      const stim = pay.stimulus_blocks ?? [];
      const at = stim.findIndex((b) => b.type === "source");
      const block = { id: `${id}b`, type: "image", asset_ref: id };
      // várias figuras do texto-base entram na ordem do job, antes da fonte
      const pos = at >= 0 ? at : stim.length;
      pay.stimulus_blocks = figAt === 0 && at < 0 && fig.before_text ? [block, ...stim] : [...stim.slice(0, pos), block, ...stim.slice(pos)];
      changed.add("stimulus_blocks");
      notes.push(`figura recortada da p. ${c.page} com texto alternativo`);
      figAt++;
    }
    changed.add("figures");
  }
  // figuras antigas sem uso (alternativas trocadas) saem da lista
  if (figList.some((f) => f.alternative)) {
    const used = new Set(JSON.stringify([pay.stimulus_blocks, pay.command_blocks, pay.alternatives]).match(/fig\d+/g) ?? []);
    pay.figures = pay.figures.filter((f) => used.has(f.id));
  }
  const reps = job.replacements?.[key];
  if (reps) {
    // substituições literais conferidas no PDF (símbolos mal mapeados pela extração)
    const fix = (blocks, field) => (blocks ?? []).map((b) => {
      if (typeof b.text !== "string") return b;
      let t = b.text;
      for (const [from, to] of reps.pairs) t = t.split(from).join(to);
      if (t !== b.text) changed.add(field);
      return t === b.text ? b : { ...b, text: t };
    });
    pay.stimulus_blocks = fix(pay.stimulus_blocks, "stimulus_blocks");
    pay.command_blocks = fix(pay.command_blocks, "command_blocks");
    pay.alternatives = Object.fromEntries(Object.entries(pay.alternatives ?? {}).map(([k, v]) => [k, fix(v, "alternatives")]));
    notes.push(reps.note);
  }
  for (const fx of job.block_fixes?.[key] ?? []) {
    // troca blocos específicos (por id) pelos blocos conferidos no PDF, na posição do primeiro
    const field = fx.field ?? "stimulus_blocks";
    const list = pay[field] ?? [];
    const at = list.findIndex((b) => b.id === fx.replace[0]);
    if (at < 0) throw new Error(`${key}: bloco ${fx.replace[0]} não encontrado em ${field}`);
    const rest = list.filter((b) => !fx.replace.includes(b.id));
    rest.splice(at, 0, ...fx.with.map((b, i) => ({ id: b.id ?? `${fx.replace[0]}${String.fromCharCode(97 + i)}`, ...b })));
    pay[field] = rest;
    changed.add(field);
    notes.push(fx.note);
  }
  const tb = job.tables?.[key];
  if (tb) {
    // linhas achatadas da tabela viram um bloco de tabela em texto ("a | b" por linha, cabeçalho primeiro)
    const stim = pay.stimulus_blocks ?? [];
    const first = stim.findIndex((b) => b.id === tb.replace[0]);
    if (first < 0) throw new Error(`${key}: bloco ${tb.replace[0]} não encontrado`);
    const rest = stim.filter((b) => !tb.replace.includes(b.id));
    const block = { id: "tab1", type: "table", text: tb.rows.map((r) => r.join(" | ")).join("\n") };
    rest.splice(first, 0, block);
    pay.stimulus_blocks = rest;
    changed.add("stimulus_blocks");
    notes.push("quadro reconstruído como tabela a partir do PDF (a extração tinha achatado as linhas e perdido as células vazias)");
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
  for (const [L, text] of Object.entries(fx?.alternatives ?? {})) {
    pay.alternatives = { ...pay.alternatives, [L]: [{ id: `a${L.toLowerCase()}`, type: "paragraph", text }] };
    changed.add("alternatives"); notes.push(`alternativa ${L} reescrita conforme o PDF`);
  }
  if (fx?.stimulus) {
    const sources = (pay.stimulus_blocks ?? []).filter((b) => b.type === "source");
    pay.stimulus_blocks = [...fx.stimulus.map((b, i) => ({ id: `s${i + 1}`, ...b })), ...sources];
    changed.add("stimulus_blocks"); notes.push(fx.stimulus_note ?? "quadro reorganizado por coluna (a extração tinha intercalado as colunas)");
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
    const figs = job.figures[key] ? (Array.isArray(job.figures[key]) ? job.figures[key] : [job.figures[key]]) : [];
    const pages = [...new Set(figs.map((f) => crops[f.crop].page))].join(", ");
    if (d.kind.startsWith("figura") && figs.length) { decision = "resolvida"; resolution = `Figura(s) recortada(s) do PDF oficial (p. ${pages}) com texto alternativo escrito sem revelar a resposta. ${WHO}`; }
    else if (d.kind.startsWith("figura") && job.tables?.[key]) { decision = "resolvida"; resolution = `O objeto detectado é o quadro da questão, reconstruído como tabela a partir do PDF oficial. ${WHO}`; }
    else if (/^alternativa/.test(d.kind) && figs.some((f) => f.alternative)) { decision = "resolvida"; resolution = `As alternativas são figuras: recortadas do PDF oficial (p. ${pages}), uma por alternativa, com texto alternativo. ${WHO}`; }
    else if (/^alternativa/.test(d.kind) && job.alternative_doubts?.[key]) { decision = "resolvida"; resolution = `${job.alternative_doubts[key]} ${WHO}`; }
    else if (d.kind.startsWith("fração") && job.formula_doubts[key]) { decision = "resolvida"; resolution = `${job.formula_doubts[key]} ${WHO}`; }
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
