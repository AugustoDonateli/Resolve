// Ajusta o tipo de blocos curtos do texto-base que a extração deixou como parágrafo: "TEXTO I/II/III"
// vira título e linhas de crédito ("Disponível em", "Acesso em") viram fonte. Texto não muda.
// Uso: RESOLVE_EDITOR_ENV=<arquivo> node tipos_de_bloco.mjs "<filtro do lote>" [DRY=1]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const read = (p) => Object.fromEntries(readFileSync(p, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const env = read(process.env.RESOLVE_EDITOR_ENV);
const web = read(new URL("../../apps/web/.env.local", import.meta.url));
const DRY = process.env.DRY === "1";
const db = createClient(web.NEXT_PUBLIC_SUPABASE_URL, web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: le } = await db.auth.signInWithPassword({ email: env.RESOLVE_EDITOR_EMAIL ?? env.E2E_EMAIL_EDITOR, password: env.RESOLVE_EDITOR_PASSWORD ?? env.E2E_PASSWORD_EDITOR });
if (le) throw le;
const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
const NOTE = `Tipo de bloco ajustado sem mudar o texto: rótulos "TEXTO I/II/III" como título e linhas de crédito como fonte. Feito por Claude (assistente de IA), a pedido de Guto, em ${today}.`;
const { data: batch } = await db.from("ingest_batches").select("id").ilike("notes", process.argv[2]).single();
const { data: props } = await db.from("item_proposals").select("id, question_number, foreign_language, payload, current_revision").eq("batch_id", batch.id).order("question_number");
const out = [];
for (const p of props) {
  let n = 0;
  const stim = (p.payload.stimulus_blocks ?? []).map((b) => {
    if (b.type !== "paragraph" || typeof b.text !== "string" || b.text.length > 160) return b;
    if (/^TEXTO [IVX]+\.?$/.test(b.text.trim())) { n++; return { ...b, type: "heading" }; }
    if (/^(Disponível em|Acesso em)\b/.test(b.text.trim())) { n++; return { ...b, type: "source" }; }
    return b;
  });
  if (!n) continue;
  const key = `${p.question_number}${p.foreign_language ? "/" + p.foreign_language : ""}`;
  if (DRY) { out.push(`${key}: ${n} bloco(s)`); continue; }
  const { data, error } = await db.rpc("revise_proposal", { p_id: p.id, p_expected_revision: p.current_revision, p_payload: { ...p.payload, stimulus_blocks: stim }, p_note: NOTE, p_changed: ["stimulus_blocks"] });
  if (error) throw new Error(`${key}: ${error.message}`);
  out.push(`${key}: ${n} bloco(s) → revisão ${data[0].revision}, ${data[0].status}`);
}
console.log(out.join("\n") || "nada a ajustar");
