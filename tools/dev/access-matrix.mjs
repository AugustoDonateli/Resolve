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

// ── Ciclo de estudo: sessões, tentativas, caderno e eventos (F3-T01/T06/T12) ──
{
  const fake = "00000000-0000-4000-8000-000000000000";
  for (const t of ["study_sessions", "session_items", "attempts", "error_entries", "attempt_events"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const ins = await A.c.from("attempts").insert({ user_id: A.id, session_item_id: fake, item_version_id: fake, item_id: fake, chosen_alternative_id: fake, is_correct: true, client_action_id: fake }).select();
  check("A", "não grava tentativa direto (nem acerto informado pelo cliente)", permError(ins), ins.error?.message ?? "gravou!");
  const ss = await A.c.from("study_sessions").insert({ user_id: A.id, client_action_id: fake, mode: "treino" }).select();
  check("A", "não cria sessão direto", permError(ss), ss.error?.message ?? "criou!");
  const st = await A.c.rpc("start_session", { p_client_action_id: crypto.randomUUID(), p_mode: "treino", p_item_version_ids: [fake] });
  check("A", "sessão só com item publicado", /resolve_item_unavailable/.test(st.error?.message ?? ""), st.error?.message ?? "iniciou!");
  const sub = await B.c.rpc("submit_attempt", { p_client_action_id: crypto.randomUUID(), p_session_item_id: fake, p_alternative_id: fake });
  check("B", "não responde em item de sessão alheia/inexistente", /resolve_session_item_not_found/.test(sub.error?.message ?? ""), sub.error?.message ?? "respondeu!");
  const ev = await B.c.rpc("log_session_events", { p_session_id: fake, p_events: [] });
  check("B", "não registra evento em sessão alheia/inexistente", /resolve_session_not_found/.test(ev.error?.message ?? ""), ev.error?.message ?? "registrou!");
  const er = await B.c.rpc("set_error_reason", { p_entry_id: fake, p_reason: "calculo" });
  check("B", "não muda motivo de erro alheio", /resolve_error_entry_not_found/.test(er.error?.message ?? ""), er.error?.message ?? "mudou!");
  const calls = {
    start_session: { p_client_action_id: fake, p_mode: "treino", p_item_version_ids: [fake] },
    submit_attempt: { p_client_action_id: fake, p_session_item_id: fake, p_alternative_id: fake },
    log_session_events: { p_session_id: fake, p_events: [] },
    set_error_reason: { p_entry_id: fake, p_reason: "calculo" },
    set_session_status: { p_session_id: fake, p_status: "encerrada" },
  };
  for (const [fn, args] of Object.entries(calls)) {
    const r = await V.c.rpc(fn, args);
    check("visitante", `não executa ${fn}`, permError(r), r.error?.message ?? "executou!");
  }
}

// ── Retorno da sessão (F3-T02) ──
{
  const fake = "00000000-0000-4000-8000-000000000000";
  const v = await V.c.rpc("session_feedback", { p_session_id: fake });
  check("visitante", "não executa session_feedback", permError(v), v.error?.message ?? "executou!");
  const b = await B.c.rpc("session_feedback", { p_session_id: fake });
  check("B", "session_feedback de sessão alheia/inexistente vem vazio", !b.error && (b.data ?? []).length === 0, b.error?.message ?? `${rows(b)} linha(s)`);
}

// ── Ocorrências (F3-T17) ──
{
  const v = await V.c.from("item_reports").select("*").limit(1);
  check("visitante", "não lê item_reports", permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  const draft = await E.c.from("item_versions").select("id").neq("review_status", "published").limit(1);
  const vid = draft.data?.[0]?.id ?? "00000000-0000-4000-8000-000000000000";
  const ins = await A.c.from("item_reports").insert({ item_version_id: vid, kind: "outro", message: "teste da matriz" }).select();
  check("A", "não relata sobre versão não publicada", Boolean(ins.error), ins.error?.message ?? "relatou!");
  const fake = await A.c.from("item_reports").insert({ item_version_id: vid, kind: "outro", message: "teste da matriz", status: "resolvida" }).select();
  check("A", "não cria relato já fechado", Boolean(fake.error), fake.error?.message ?? "criou!");
  const others = await B.c.from("item_reports").select("id").neq("user_id", B.id);
  check("B", "não lê relatos de outras contas", denied(others), others.error?.message ?? `${rows(others)} linha(s)`);
}

// ── Triagem (F4-T04) ──
{
  const v = await V.c.from("triage_decisions").select("*").limit(1);
  check("visitante", "não lê triage_decisions", permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  const vr = await V.c.rpc("record_triage", { p_client_action_id: crypto.randomUUID(), p_session_item_id: crypto.randomUUID(), p_decision: "agora", p_visible_ms: 1000 });
  check("visitante", "não executa record_triage", permError(vr), vr.error?.message ?? "executou!");
  const b = await B.c.rpc("record_triage", { p_client_action_id: crypto.randomUUID(), p_session_item_id: crypto.randomUUID(), p_decision: "agora", p_visible_ms: 1000 });
  check("B", "não decide em questão de sessão alheia/inexistente", /session_item_not_found/.test(b.error?.message ?? ""), b.error?.message ?? "decidiu!");
  const w = await B.c.from("triage_decisions").insert({}).select();
  check("B", "não grava triage_decisions direto", permError(w), w.error?.message ?? "gravou!");
}

// ── Agenda de revisão (F3-T07) ──
{
  for (const t of ["review_items", "review_events"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
    const b = await B.c.from(t).insert({}).select();
    check("B", `não grava ${t} direto`, permError(b), b.error?.message ?? "gravou!");
  }
  const vq = await V.c.rpc("review_queue", { p_available_minutes: 30 });
  check("visitante", "não executa review_queue", permError(vq), vq.error?.message ?? "executou!");
  const bq = await B.c.rpc("review_queue", { p_available_minutes: 30 });
  check("B", "fila de revisão só com o que é dele", !bq.error && Array.isArray(bq.data), bq.error?.message ?? `${rows(bq)} item(ns)`);
  const sc = await A.c.from("review_schedulers").select("version, intervals_days").eq("version", "srs-v1").single();
  check("A", "lê a agenda versionada (1, 3, 7, 14, 30)", JSON.stringify(sc.data?.intervals_days) === "[1,3,7,14,30]", sc.error?.message ?? JSON.stringify(sc.data));
  check("B", "fila de revisão informa o tipo (questão ou cartão)", !bq.error && (bq.data ?? []).every((x) => ["questao", "cartao"].includes(x.kind)), bq.error?.message ?? "");
}

// ── Cartões revisados (F3-T09) ──
// Só rascunho: cartão publicado não pode ser apagado, e a matriz não deixa rastro.
{
  for (const t of ["concept_cards", "card_review_items", "card_reviews"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  for (const t of ["card_review_items", "card_reviews"]) {
    const b = await B.c.from(t).insert({}).select();
    check("B", `não grava ${t} direto`, permError(b), b.error?.message ?? "gravou!");
  }
  for (const fn of ["review_card", "add_card_to_review"]) {
    const args = fn === "review_card"
      ? { p_client_action_id: crypto.randomUUID(), p_card_id: crypto.randomUUID(), p_recalled: true }
      : { p_card_id: crypto.randomUUID() };
    const v = await V.c.rpc(fn, args);
    check("visitante", `não executa ${fn}`, permError(v), v.error?.message ?? "executou!");
  }
  const src = await E.c.from("sources").select("id").eq("kind", "matriz").limit(1);
  const card = { area_code: "LC", front: "Cartão da matriz de acesso", back: "rascunho de teste", source_id: src.data?.[0]?.id, source_locator: "teste" };
  const ins = await E.c.from("concept_cards").insert(card).select("id, status").single();
  check("E", "cria cartão como rascunho", !ins.error && ins.data?.status === "rascunho", ins.error?.message ?? "");
  const pub = await E.c.from("concept_cards").insert({ ...card, status: "publicado" }).select();
  check("E", "não cria cartão já publicado", Boolean(pub.error), pub.error?.message ?? "criou!");
  const draftId = ins.data?.id;
  if (draftId) {
    for (const [who, s] of [["A", A], ["B", B]]) {
      const r = await s.c.from("concept_cards").select("id").eq("id", draftId);
      check(who, "não lê cartão em rascunho", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
      const up = await s.c.from("concept_cards").update({ status: "publicado" }).eq("id", draftId).select();
      check(who, "não publica cartão", denied(up), up.error?.message ?? `${rows(up)} linha(s)`);
      const add = await s.c.rpc("add_card_to_review", { p_card_id: draftId });
      check(who, "não põe rascunho na fila", /resolve_card_unavailable/.test(add.error?.message ?? ""), add.error?.message ?? "pôs!");
      const rv = await s.c.rpc("review_card", { p_client_action_id: crypto.randomUUID(), p_card_id: draftId, p_recalled: true });
      check(who, "não revisa cartão fora da própria fila", /resolve_card_not_in_review/.test(rv.error?.message ?? ""), rv.error?.message ?? "revisou!");
    }
    const ai = await A.c.from("concept_cards").insert(card).select();
    check("A", "não cria cartão", permError(ai), ai.error?.message ?? "criou!");
    const del = await E.c.from("concept_cards").delete().eq("id", draftId).select();
    check("E", "apaga o próprio rascunho de teste", rows(del) === 1, del.error?.message ?? `${rows(del)} linha(s)`);
  }
}

// ── Rotina: disponibilidade, compromissos e exceções (F4-T13) ──
{
  for (const t of ["availability_rules", "fixed_commitments", "schedule_exceptions"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const vo = await V.c.rpc("schedule_occurrences", { p_from: "2026-11-16", p_to: "2026-11-22" });
  check("visitante", "não executa schedule_occurrences", permError(vo), vo.error?.message ?? "executou!");
  const mine = await A.c.from("fixed_commitments").insert({ title: "Matriz de acesso", weekday: 0, start_time: "06:00", end_time: "06:05" }).select("id").single();
  check("A", "cria o próprio compromisso", !mine.error && Boolean(mine.data?.id), mine.error?.message ?? "");
  const cid = mine.data?.id;
  if (cid) {
    for (const [who, s] of [["B", B], ["E", E]]) {
      const r = await s.c.from("fixed_commitments").select("id").eq("id", cid);
      check(who, "não lê compromisso de A", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
      const u = await s.c.from("fixed_commitments").update({ title: "invadido" }).eq("id", cid).select();
      check(who, "não altera compromisso de A", denied(u), u.error?.message ?? `${rows(u)} linha(s)`);
      const d = await s.c.from("fixed_commitments").delete().eq("id", cid).select();
      check(who, "não apaga compromisso de A", denied(d), d.error?.message ?? `${rows(d)} linha(s)`);
      const x = await s.c.from("schedule_exceptions").insert({ kind: "compromisso", action: "cancelar", commitment_id: cid, on_date: "2026-11-15" }).select();
      check(who, "não cancela um dia do compromisso de A", Boolean(x.error), x.error?.message ?? "cancelou!");
      const o = await s.c.rpc("schedule_occurrences", { p_from: "2026-11-15", p_to: "2026-11-21" });
      check(who, "ocorrências só da própria conta", !o.error && (o.data ?? []).every((y) => y.source_id !== cid), o.error?.message ?? "");
    }
    const ins = await B.c.from("availability_rules").insert({ user_id: A.id, weekday: 2, start_time: "08:00", end_time: "09:00" }).select();
    check("B", "não grava horário em nome de A", permError(ins), ins.error?.message ?? "gravou!");
    const del = await A.c.from("fixed_commitments").delete().eq("id", cid).select("id");
    check("A", "apaga o próprio compromisso de teste", rows(del) === 1, del.error?.message ?? `${rows(del)} linha(s)`);
  }
}

// ── Metas e planos se-então (F4-T14) ──
{
  for (const t of ["goals", "if_then_plans"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const g = await A.c.from("if_then_plans").insert({ trigger_text: "Se a matriz rodar", alternative_activity: "confiro o acesso", duration_minutes: 5 }).select("id").single();
  check("A", "cria o próprio plano se-então", !g.error && Boolean(g.data?.id), g.error?.message ?? "");
  if (g.data?.id) {
    for (const [who, s] of [["B", B], ["E", E]]) {
      const r = await s.c.from("if_then_plans").select("id").eq("id", g.data.id);
      check(who, "não lê plano de A", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
      const u = await s.c.from("if_then_plans").update({ duration_minutes: 1 }).eq("id", g.data.id).select();
      check(who, "não altera plano de A", denied(u), u.error?.message ?? `${rows(u)} linha(s)`);
    }
    const ins = await B.c.from("goals").insert({ user_id: A.id, level: "semanal", target_minutes: 60 }).select();
    check("B", "não grava meta em nome de A", permError(ins), ins.error?.message ?? "gravou!");
    await A.c.from("if_then_plans").delete().eq("id", g.data.id);
  }
}

// ── Plano do dia (F4-T15) ──
{
  for (const t of ["study_blocks", "study_plan_days"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const mine = await A.c.from("study_blocks").insert({ local_date: "2026-11-10", timezone: "America/Sao_Paulo", start_minute: 600, planned_minutes: 25, kind: "treino", title: "Matriz de acesso" }).select("id").single();
  check("A", "cria o próprio bloco", !mine.error && Boolean(mine.data?.id), mine.error?.message ?? "");
  if (mine.data?.id) {
    const r = await B.c.from("study_blocks").select("id").eq("id", mine.data.id);
    check("B", "não lê bloco de A", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
    const u = await B.c.from("study_blocks").update({ status: "dispensado" }).eq("id", mine.data.id).select();
    check("B", "não altera bloco de A", denied(u), u.error?.message ?? `${rows(u)} linha(s)`);
    await A.c.from("study_blocks").delete().eq("id", mine.data.id);
  }
  const ins = await B.c.from("study_plan_days").insert({ user_id: A.id, local_date: "2026-11-10", left_out: [] }).select();
  check("B", "não grava plano do dia em nome de A", permError(ins), ins.error?.message ?? "gravou!");
}

// ── Folga e sequência (F4-T18) ──
{
  const v = await V.c.from("rest_days").select("*").limit(1);
  check("visitante", "não lê rest_days", permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  const vs = await V.c.rpc("streak_status");
  check("visitante", "não executa streak_status", permError(vs), vs.error?.message ?? "executou!");
  const st = await A.c.rpc("streak_status");
  const today = st.data?.[0]?.today;
  check("A", "lê a própria sequência (regra sequencia-v1)", st.data?.[0]?.rule_version === "sequencia-v1", st.error?.message ?? "");
  if (today) {
    // Folga de hoje fica no histórico: a conta de teste A acumula essa linha de propósito.
    // (a regra de folgas pode recusar a de hoje; aí o teste usa a folga mais recente que já está no histórico)
    await A.c.from("rest_days").insert({ rest_date: today });
    const last = (await A.c.from("rest_days").select("rest_date").lte("rest_date", today).order("rest_date", { ascending: false }).limit(1)).data?.[0]?.rest_date;
    if (last) {
      const del = await A.c.from("rest_days").delete().eq("rest_date", last).select();
      const kept = (await A.c.from("rest_days").select("rest_date").eq("rest_date", last)).data?.length === 1;
      check("A", "não apaga folga de hoje ou passada (histórico)", (Boolean(del.error) || rows(del) === 0) && kept, del.error?.message ?? `${rows(del)} linha(s) apagada(s)`);
    } else check("A", "não apaga folga de hoje ou passada (histórico)", false, "nenhuma folga no histórico da conta A para testar");
    const past = await A.c.from("rest_days").insert({ rest_date: "2020-01-06" }).select();
    check("A", "não marca folga no passado", Boolean(past.error), past.error?.message ?? "marcou!");
    const b = await B.c.from("rest_days").insert({ user_id: A.id, rest_date: today }).select();
    check("B", "não marca folga em nome de A", Boolean(b.error), b.error?.message ?? "marcou!");
    const bl = await B.c.from("rest_days").select("rest_date").eq("user_id", A.id);
    check("B", "não lê folgas de A", denied(bl), bl.error?.message ?? `${rows(bl)} linha(s)`);
  }
}

// ── Redação (F5-T02) ──
{
  for (const t of ["essays", "essay_versions", "essay_jobs", "essay_evaluations", "essay_results", "essay_annotations", "essay_rubrics"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const dims = await A.c.from("rubric_dimensions").select("code").order("code");
  check("A", "lê as 5 competências da rubrica oficial", (dims.data ?? []).map((d) => d.code).join() === "C1,C2,C3,C4,C5", dims.error?.message ?? JSON.stringify(dims.data));
  const es = await A.c.from("essays").insert({}).select("id").single();
  check("A", "cria a própria redação (tema livre)", Boolean(es.data), es.error?.message ?? "");
  const essayId = es.data?.id;
  const ver = await A.c.from("essay_versions").insert({ essay_id: essayId, paragraphs_json: [{ id: "p1", text: "Rascunho da matriz de acesso." }] }).select("id, plain_text").single();
  check("A", "cria rascunho; texto corrido vem dos parágrafos", ver.data?.plain_text === "Rascunho da matriz de acesso.", ver.error?.message ?? JSON.stringify(ver.data));
  for (const [who, s] of [["B", B], ["E", E]]) {
    const r1 = await s.c.from("essays").select("id").eq("id", essayId);
    check(who, "não lê a redação de A", denied(r1), r1.error?.message ?? `${rows(r1)} linha(s)`);
    const r2 = await s.c.from("essay_versions").select("id").eq("essay_id", essayId);
    check(who, "não lê as versões de A", denied(r2), r2.error?.message ?? `${rows(r2)} linha(s)`);
    const up = await s.c.from("essay_versions").update({ paragraphs_json: [{ id: "p1", text: "invadido" }] }).eq("essay_id", essayId).select();
    check(who, "não altera o rascunho de A", denied(up), up.error?.message ?? `${rows(up)} linha(s)`);
    const ins = await s.c.from("essay_versions").insert({ essay_id: essayId, paragraphs_json: [{ id: "p1", text: "intruso" }] }).select();
    check(who, "não cria versão na redação de A", permError(ins), ins.error?.message ?? "criou!");
    const rm = await s.c.from("essays").delete().eq("id", essayId).select();
    check(who, "não apaga a redação de A", denied(rm), rm.error?.message ?? `${rows(rm)} linha(s)`);
  }
  const job = await A.c.from("essay_jobs").insert({ version_id: ver.data?.id, model_policy_id: "x", idempotency_key: "matriz-de-acesso" }).select();
  check("A", "não cria correção direto", permError(job), job.error?.message ?? "criou!");
  for (const t of ["essay_evaluations", "essay_results", "essay_annotations"]) {
    const w = await A.c.from(t).insert({}).select();
    check("A", `não grava ${t} direto`, permError(w), w.error?.message ?? "gravou!");
  }
  const pr = await A.c.from("essay_prompts").insert({ title: "Tema intruso", instruction: "não deveria entrar" }).select();
  check("A", "não cria tema de redação", permError(pr), pr.error?.message ?? "criou!");
  const still = await A.c.from("essay_versions").select("plain_text").eq("essay_id", essayId);
  check("A", "rascunho continua intacto", rows(still) === 1 && still.data[0].plain_text === "Rascunho da matriz de acesso.", JSON.stringify(still.data));
  const del = await A.c.from("essays").delete().eq("id", essayId).select();
  check("A", "apaga a própria redação sem versão enviada", rows(del) === 1, del.error?.message ?? `${rows(del)} linha(s)`);
}

// ── Temas de redação (F5-T03) ──
{
  const draft = await E.c.from("essay_prompts").select("id").eq("status", "draft").eq("origin", "oficial").limit(1);
  const draftId = draft.data?.[0]?.id;
  // O tema oficial de 2025 foi publicado em 11/11/2026; sem rascunho, valem as regras de tema publicado.
  const pub = await E.c.from("essay_prompts").select("id").eq("status", "published").eq("origin", "oficial").limit(1);
  const pubId = pub.data?.[0]?.id;
  if (pubId) {
    for (const [who, s] of [["A", A], ["B", B]]) {
      const r = await s.c.from("essay_prompts").select("id").eq("id", pubId);
      check(who, "lê tema publicado", rows(r) === 1, r.error?.message ?? `${rows(r)} linha(s)`);
      const up = await s.c.from("motivating_texts").update({ rights_status: "pendente" }).eq("prompt_id", pubId).select();
      check(who, "não altera texto de tema publicado", denied(up) || permError(up), up.error?.message ?? `${rows(up)} linha(s)`);
    }
    const eu = await E.c.from("motivating_texts").update({ rights_status: "pendente" }).eq("prompt_id", pubId).select();
    check("E", "não altera texto de tema publicado", Boolean(eu.error) || rows(eu) === 0, eu.error?.message ?? `${rows(eu)} linha(s)`);
  }
  check("E", "lê o tema oficial (rascunho ou publicado)", Boolean(draftId || pubId), draft.error?.message ?? "nenhum tema");
  if (draftId) {
    const t = await E.c.from("motivating_texts").select("blocks").eq("prompt_id", draftId);
    const fig = (t.data ?? []).flatMap((x) => x.blocks).find((b) => b.type === "image")?.asset_ref;
    for (const [who, s] of [["A", A], ["B", B]]) {
      const r = await s.c.from("essay_prompts").select("id").eq("id", draftId);
      check(who, "não lê tema em rascunho", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
      const m = await s.c.from("motivating_texts").select("id").eq("prompt_id", draftId);
      check(who, "não lê textos de tema em rascunho", denied(m), m.error?.message ?? `${rows(m)} linha(s)`);
      if (fig) {
        const dl = await s.c.storage.from("editorial").download(fig);
        check(who, "não baixa figura de tema em rascunho", permError(dl) || Boolean(dl.error), dl.error?.message ?? "baixou!");
      }
      const bl = await s.c.rpc("essay_prompt_blockers", { p_prompt: draftId });
      check(who, "não obtém impedimentos de tema (só editor)", bl.data === null, bl.error?.message ?? JSON.stringify(bl.data));
      const up = await s.c.from("motivating_texts").update({ rights_status: "verificado" }).eq("prompt_id", draftId).select();
      check(who, "não confere texto motivador", denied(up), up.error?.message ?? `${rows(up)} linha(s)`);
    }
    const vb = await V.c.rpc("essay_prompt_blockers", { p_prompt: draftId });
    check("visitante", "não executa essay_prompt_blockers", permError(vb), vb.error?.message ?? "executou!");
  }
}

// ── Fila de correção e orçamento (F5-T08) ──
{
  for (const t of ["ai_budgets", "ai_budget_policies", "ai_reservations", "ai_usage", "job_runs", "ai_model_policies"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  for (const t of ["ai_budgets", "ai_budget_policies", "ai_reservations"]) {
    const r = await A.c.from(t).select("id").limit(1);
    check("A", `não lê ${t} (só editor)`, denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
  }
  for (const t of ["ai_usage", "job_runs", "ai_budgets", "ai_reservations"]) {
    const w = await A.c.from(t).insert({}).select();
    check("A", `não grava ${t} direto`, permError(w), w.error?.message ?? "gravou!");
  }
  const pol = await A.c.from("ai_model_policies").select("id, status").eq("id", "redacao-ref-v0");
  check("A", "lê a política de modelo de referência", rows(pol) === 1, pol.error?.message ?? `${rows(pol)} linha(s)`);
  const es = await A.c.from("essays").insert({}).select("id").single();
  const ver = await A.c.from("essay_versions").insert({ essay_id: es.data?.id, paragraphs_json: [{ id: "p1", text: "Rascunho da matriz (fila)." }] }).select("id").single();
  const vs = await V.c.rpc("submit_essay", { p_version_id: ver.data?.id, p_idempotency_key: "matriz-visitante" });
  check("visitante", "não envia redação para correção", permError(vs), vs.error?.message ?? "enviou!");
  const bs = await B.c.rpc("submit_essay", { p_version_id: ver.data?.id, p_idempotency_key: "matriz-de-b-0001" });
  check("B", "não envia a versão de A para correção", /resolve_essay_not_found/.test(bs.error?.message ?? ""), bs.error?.message ?? "enviou!");
  const st = await A.c.from("essay_versions").select("status").eq("id", ver.data?.id).single();
  check("A", "rascunho continua rascunho depois da tentativa de B", st.data?.status === "rascunho", JSON.stringify(st.data));
  const br = await B.c.rpc("retry_essay_job", { p_job_id: "00000000-0000-0000-0000-000000000000" });
  check("B", "não pede nova tentativa de trabalho inexistente/alheio", /resolve_job_not_found/.test(br.error?.message ?? ""), br.error?.message ?? "pediu!");
  const ju = await A.c.from("essay_jobs").update({ status: "pronto" }).eq("user_id", A.id).select();
  check("A", "não muda o estado da própria correção", permError(ju) || denied(ju), ju.error?.message ?? `${rows(ju)} linha(s)`);
  await A.c.from("essays").delete().eq("id", es.data?.id);
}

// ── Grupos e duelos, repertório, trilha, questão do dia e data da prova ──
{
  for (const t of ["study_groups", "study_group_members", "duels", "duel_entries", "repertoire_items", "essay_track_progress"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, permError(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  const vd = await V.c.rpc("daily_question", { p_local_date: "2026-11-10" });
  check("visitante", "não pede a questão do dia", permError(vd), vd.error?.message ?? "respondeu!");
  // Grupo fixo da matriz (reaproveitado entre execuções: grupos não são apagados).
  let gid = (await A.c.from("study_groups").select("id").eq("name", "Matriz de acesso").eq("created_by", A.id).maybeSingle()).data?.id;
  if (!gid) {
    const cg = await A.c.rpc("create_group", { p_name: "Matriz de acesso", p_nickname: "Conta A" });
    check("A", "cria grupo pela função", !cg.error && Boolean(cg.data), cg.error?.message ?? "");
    gid = cg.data;
  }
  const code = (await A.c.from("study_groups").select("invite_code").eq("id", gid).single()).data?.invite_code;
  check("A", "vê o código do próprio grupo", typeof code === "string" && code.length === 8);
  await B.c.rpc("leave_group", { p_group: gid });
  const bg = await B.c.from("study_groups").select("id").eq("id", gid);
  check("B", "não vê grupo de que não participa", denied(bg), bg.error?.message ?? `${rows(bg)} linha(s)`);
  const bm = await B.c.from("study_group_members").select("nickname").eq("group_id", gid);
  check("B", "não vê membros de grupo alheio", denied(bm), bm.error?.message ?? `${rows(bm)} linha(s)`);
  const bi = await B.c.from("study_group_members").insert({ group_id: gid, user_id: B.id, nickname: "Intrusa" }).select();
  check("B", "não entra no grupo sem o código", permError(bi), bi.error?.message ?? "entrou!");
  const bd = await B.c.rpc("create_duel", { p_group: gid, p_area: null, p_count: 5 });
  check("B", "não lança duelo em grupo alheio", /resolve_not_member/.test(bd.error?.message ?? ""), bd.error?.message ?? "lançou!");
  const ai = await A.c.from("duels").insert({ group_id: gid, created_by: A.id, item_version_ids: [], closes_at: new Date().toISOString() }).select();
  check("A", "não grava duelo direto na tabela", permError(ai), ai.error?.message ?? "gravou!");
  const bj = await B.c.rpc("join_group", { p_code: code, p_nickname: "Conta B" });
  check("B", "entra com o código", !bj.error && bj.data === gid, bj.error?.message ?? "");
  const bm2 = await B.c.from("study_group_members").select("nickname").eq("group_id", gid).is("left_at", null);
  check("B", "depois de entrar vê só apelidos dos membros", rows(bm2) >= 2, bm2.error?.message ?? `${rows(bm2)} linha(s)`);
  await B.c.rpc("leave_group", { p_group: gid });
  const bg2 = await B.c.from("study_groups").select("id").eq("id", gid);
  check("B", "depois de sair não vê mais o grupo", denied(bg2), bg2.error?.message ?? `${rows(bg2)} linha(s)`);

  const rep = await A.c.from("repertoire_items").insert({ kind: "conceito", content: "Item da matriz de acesso", source: "teste automatizado da matriz" }).select("id").single();
  check("A", "cria item de repertório", !rep.error, rep.error?.message ?? "");
  if (rep.data?.id) {
    const r = await B.c.from("repertoire_items").select("id").eq("id", rep.data.id);
    check("B", "não lê repertório de A", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
    const u = await B.c.from("repertoire_items").update({ content: "alterado por B" }).eq("id", rep.data.id).select();
    check("B", "não altera repertório de A", denied(u), u.error?.message ?? `${rows(u)} linha(s)`);
    await A.c.from("repertoire_items").update({ archived_at: new Date().toISOString() }).eq("id", rep.data.id);
  }
  const tr = await B.c.from("essay_track_progress").insert({ user_id: A.id, step: "matriz" }).select();
  check("B", "não marca a trilha em nome de A", permError(tr), tr.error?.message ?? "marcou!");
  const vg = await V.c.from("course_goals").select("*").limit(1);
  check("visitante", "não lê course_goals", permError(vg), vg.error?.message ?? `${rows(vg)} linha(s)`);
  const cg = await A.c.from("course_goals").insert({ course: "Curso da matriz", institution: "Teste automatizado" }).select("id").single();
  check("A", "cria meta de curso", !cg.error, cg.error?.message ?? "");
  if (cg.data?.id) {
    const r = await B.c.from("course_goals").select("id").eq("id", cg.data.id);
    check("B", "não lê meta de curso de A", denied(r), r.error?.message ?? `${rows(r)} linha(s)`);
    await A.c.from("course_goals").update({ archived_at: new Date().toISOString() }).eq("id", cg.data.id);
  }
  const ns = await A.c.from("course_goals").insert({ course: "Curso", institution: "Sem fonte", cutoff: 700 }).select();
  check("A", "nota de corte sem fonte é recusada", Boolean(ns.error), ns.error?.message ?? "gravou!");
  const vc = await V.c.from("item_corrections").select("*").limit(1);
  check("visitante", "não lê item_corrections", permError(vc), vc.error?.message ?? `${rows(vc)} linha(s)`);
  const ac = await A.c.from("item_corrections").select("id").limit(1);
  check("A", "não lê correções editoriais", denied(ac), ac.error?.message ?? `${rows(ac)} linha(s)`);
  const ar = await A.c.rpc("correct_published_item", { p_item_version: "00000000-0000-0000-0000-000000000000", p_alternatives: {}, p_command_blocks: null, p_stimulus_blocks: null, p_note: "tentativa da matriz" });
  check("A", "não corrige questão publicada", /resolve_not_editor/.test(ar.error?.message ?? ""), ar.error?.message ?? "corrigiu!");
  const ex = await B.c.from("profiles").update({ exam_day1: "2027-11-07" }).eq("user_id", A.id).select();
  check("B", "não muda a data da prova de A", denied(ex), ex.error?.message ?? `${rows(ex)} linha(s)`);
}

// ── TRI e taxas de acerto (microdados) ──
{
  for (const t of ["parameter_sets", "item_parameters", "tri_model_versions", "tri_model_parameter_sets", "item_response_stats"]) {
    const v = await V.c.from(t).select("*").limit(1);
    check("visitante", `não lê ${t}`, denied(v), v.error?.message ?? `${rows(v)} linha(s)`);
  }
  for (const t of ["parameter_sets", "item_parameters", "tri_model_versions"]) {
    const r = await A.c.from(t).select("*").limit(1);
    check("A", `lê ${t}`, !r.error && rows(r) >= 0, r.error?.message ?? "");
  }
  // a distribuição por alternativa denuncia o gabarito: conta comum só vê pelo Raio-X, depois de responder
  const st = await A.c.from("item_response_stats").select("item_id, alternatives").limit(3);
  check("A", "não lê as taxas de acerto direto", denied(st), st.error?.message ?? `${rows(st)} linha(s)`);
  const es = await E.c.from("item_response_stats").select("item_id").limit(1);
  check("E", "lê as taxas de acerto", !es.error, es.error?.message ?? "");
  const src = (await E.c.from("sources").select("id").limit(1).single()).data?.id;
  const fake = "00000000-0000-4000-8000-000000000000";
  const ins = await A.c.from("item_response_stats").insert({ item_id: fake, source_id: src, population: "teste", respondents: 1, correct: 1, blank: 0 }).select();
  check("A", "não grava taxa de acerto", permError(ins) || denied(ins), ins.error?.message ?? "gravou!");
  const ps = await A.c.from("parameter_sets").insert({ label: "teste da matriz", source_id: src, area_id: fake, model_family: "3pl", scale_constant: 1 }).select();
  check("A", "não cria conjunto de parâmetros", permError(ps) || denied(ps), ps.error?.message ?? "criou!");
  const up = await A.c.from("item_parameters").update({ a: 9 }).neq("item_id", fake).select();
  check("A", "não altera parâmetro de item", denied(up), up.error?.message ?? `${rows(up)} linha(s)`);
  const mv = await A.c.from("tri_model_versions").update({ validation_status: "validado" }).neq("id", "x").select();
  check("A", "não altera versão do modelo", denied(mv), mv.error?.message ?? `${rows(mv)} linha(s)`);
}

// ── Anotação editorial (propostas, aprovação) e árvore de assuntos ──
{
  const v = await V.c.from("item_annotation_proposals").select("id").limit(1);
  check("visitante", "não lê propostas de anotação", denied(v), v.error?.message ?? `${rows(v)} linha(s)`);
  const a = await A.c.from("item_annotation_proposals").select("id, payload").limit(1);
  check("A", "não lê propostas de anotação (trazem o gabarito)", denied(a), a.error?.message ?? `${rows(a)} linha(s)`);
  const e = await E.c.from("item_annotation_proposals").select("id").limit(1);
  check("E", "lê propostas de anotação", !e.error && rows(e) >= 1, e.error?.message ?? "");
  const fake = "00000000-0000-4000-8000-000000000000";
  const ai = await A.c.from("item_annotation_proposals").insert({ item_version_id: fake, payload: { schema: "anotacao/v1" }, origin: "teste da matriz" }).select();
  check("A", "não cria proposta de anotação", permError(ai) || denied(ai), ai.error?.message ?? "criou!");
  const ap = await A.c.rpc("approve_item_annotation", { p_proposal: e.data?.[0]?.id ?? fake });
  check("A", "não aprova anotação", /resolve_not_editor/.test(ap.error?.message ?? ""), ap.error?.message ?? "aprovou!");
  const rt = await B.c.rpc("return_item_annotation", { p_proposal: e.data?.[0]?.id ?? fake, p_note: "tentativa de devolução pela matriz" });
  check("B", "não devolve anotação", /resolve_not_editor/.test(rt.error?.message ?? ""), rt.error?.message ?? "devolveu!");
  const sj = await A.c.from("subjects").select("code").not("code", "is", null).limit(3);
  check("A", "lê a árvore de assuntos", !sj.error && rows(sj) > 0, sj.error?.message ?? "");
  const vs = await V.c.from("subjects").select("code").limit(1);
  check("visitante", "não lê a árvore de assuntos", denied(vs), vs.error?.message ?? `${rows(vs)} linha(s)`);
  const si = await A.c.from("subjects").insert({ label: "assunto falso", area_code: "MT" }).select();
  check("A", "não cria assunto", permError(si) || denied(si), si.error?.message ?? "criou!");
}

// ── Grupos: tempo de estudo da semana (polimento P5) ──
{
  const mine = await A.c.from("study_group_members").select("group_id").eq("user_id", A.id).is("left_at", null);
  const gid = mine.data?.[0]?.group_id;
  check("A", "participa de um grupo de teste", Boolean(gid), mine.error?.message ?? "");
  if (gid) {
    const vb = await V.c.rpc("group_week_board", { p_group: gid });
    check("visitante", "não lê o placar da semana", denied(vb), vb.error?.message ?? "leu!");
    const eb = await E.c.rpc("group_week_board", { p_group: gid });
    check("E", "fora do grupo, não lê o placar da semana", denied(eb), eb.error?.message ?? "sem conteúdo");
    const eg = await E.c.rpc("set_group_weekly_goal", { p_group: gid, p_minutes: 120 });
    check("E", "fora do grupo, não muda a meta coletiva", /resolve_not_member/.test(eg.error?.message ?? ""), eg.error?.message ?? "mudou!");
    const es = await E.c.rpc("set_group_time_sharing", { p_group: gid, p_share: true });
    check("E", "fora do grupo, não entra no ranking", /resolve_not_member/.test(es.error?.message ?? ""), es.error?.message ?? "entrou!");
    const direct = await A.c.from("study_group_members").update({ share_time: true }).eq("group_id", gid).neq("user_id", A.id).select("user_id");
    check("A", "não põe outra pessoa no ranking", permError(direct) || denied(direct), direct.error?.message ?? `${rows(direct)} linha(s)`);
    const goal = await A.c.from("study_groups").update({ weekly_goal_minutes: 99 }).eq("id", gid).select("id");
    check("A", "não altera o grupo direto na tabela", permError(goal) || denied(goal), goal.error?.message ?? `${rows(goal)} linha(s)`);
    await A.c.rpc("set_group_time_sharing", { p_group: gid, p_share: false });
    const hidden = await A.c.rpc("group_week_board", { p_group: gid });
    const others = (hidden.data?.members ?? []).filter((m) => !m.me && !m.sharing);
    check("A", "lê o placar do próprio grupo", !hidden.error && Array.isArray(hidden.data?.members), hidden.error?.message ?? "");
    check("A", "de quem não participa do ranking, só recebe o apelido", others.every((m) => m.minutes === null && m.questions === null && m.studying_now === null), `${others.length} fora do ranking`);
    const bad = await A.c.rpc("set_group_weekly_goal", { p_group: gid, p_minutes: 5 });
    check("A", "meta coletiva fora do intervalo é recusada", /resolve_group_goal/.test(bad.error?.message ?? ""), bad.error?.message ?? "aceitou!");
    for (const t of ["group_applause", "time_duels"]) {
      for (const [who, u] of [["visitante", V], ["A", A]]) {
        const r = await u.c.from(t).select("group_id").limit(1);
        check(who, `não lê ${t} direto`, permError(r), r.error?.message ?? `${rows(r)} linha(s)`);
      }
      const w = await A.c.from(t).insert(t === "group_applause" ? { group_id: gid, week_start: "2026-11-16", from_user: A.id, to_user: B.id } : { group_id: gid, week_start: "2026-11-16", challenger: A.id, opponent: B.id }).select();
      check("A", `não grava em ${t} direto`, permError(w), w.error?.message ?? "gravou!");
    }
    const ea = await E.c.rpc("applaud_member", { p_group: gid, p_to: A.id });
    check("E", "fora do grupo, não aplaude", /resolve_not_in_ranking/.test(ea.error?.message ?? ""), ea.error?.message ?? "aplaudiu!");
    const ed = await E.c.rpc("challenge_time_duel", { p_group: gid, p_opponent: A.id });
    check("E", "fora do grupo, não desafia", /resolve_not_in_ranking/.test(ed.error?.message ?? ""), ed.error?.message ?? "desafiou!");
    const self = await A.c.rpc("applaud_member", { p_group: gid, p_to: A.id });
    check("A", "não aplaude a si mesmo", /resolve_not_in_ranking/.test(self.error?.message ?? ""), self.error?.message ?? "aplaudiu!");
    const off = await A.c.rpc("applaud_member", { p_group: gid, p_to: B.id });
    check("A", "fora do ranking, não aplaude", /resolve_not_in_ranking/.test(off.error?.message ?? ""), off.error?.message ?? "aplaudiu!");
    const er = await E.c.rpc("group_week_recap", { p_group: gid });
    check("E", "fora do grupo, não lê o resumo da semana", denied(er), er.error?.message ?? "sem conteúdo");
    const ar = await A.c.rpc("group_week_recap", { p_group: gid });
    check("A", "lê o resumo da semana do próprio grupo", !ar.error && Array.isArray(ar.data?.members), ar.error?.message ?? "");
    const secs = await A.c.rpc("study_seconds", { p_user: B.id, p_from: "2026-01-01", p_to: "2027-01-01" });
    check("A", "não calcula o tempo de outra conta", Boolean(secs.error), secs.error?.message ?? "calculou!");
  }
}

// ── Perfil de aprendizado (polimento P6) ──
{
  const vp = await V.c.rpc("learning_profile");
  check("visitante", "não recebe perfil de aprendizado", denied(vp), vp.error?.message ?? "sem conteúdo");
  const ap = await A.c.rpc("learning_profile");
  check("A", "recebe o próprio perfil (somas por área, tema e tipo de erro)", !ap.error && Array.isArray(ap.data?.areas) && Array.isArray(ap.data?.themes) && Array.isArray(ap.data?.distractors), ap.error?.message ?? "");
  const keys = new Set((ap.data?.areas ?? []).flatMap((x) => Object.keys(x)));
  check("A", "o perfil não traz questão, alternativa nem gabarito", ![...keys].some((k) => /item|alternative|key|correct_alternative/.test(k)), [...keys].join(","));
  for (const fn of ["study_habits", "my_weeks"]) {
    const v = await V.c.rpc(fn);
    check("visitante", `não chama ${fn}`, denied(v), v.error?.message ?? "sem conteúdo");
    const r = await A.c.rpc(fn);
    check("A", `recebe ${fn} da própria conta`, !r.error && r.data !== null, r.error?.message ?? "");
  }
  const many = await A.c.rpc("my_weeks", { p_weeks: 500 });
  check("A", "my_weeks devolve no máximo 12 semanas", !many.error && (many.data ?? []).length === 12, many.error?.message ?? `${(many.data ?? []).length} semanas`);
  const aa = await A.c.from("alternative_annotations").select("alternative_id").limit(1);
  check("A", "não lê a classificação das alternativas direto", denied(aa), aa.error?.message ?? `${rows(aa)} linha(s)`);
}

// ── Tempo de estudo automático (pedido de Guto, 17/11) ──
{
  const vp = await V.c.rpc("ping_study", { p_kind: "questoes" });
  check("visitante", "não registra presença", Boolean(vp.error), vp.error?.message ?? "registrou!");
  const bad = await A.c.rpc("ping_study", { p_kind: "outra" });
  check("A", "presença com tipo inválido é recusada", /resolve_presence_kind/.test(bad.error?.message ?? ""), bad.error?.message ?? "aceitou!");
  const ok = await A.c.rpc("ping_study", { p_kind: "questoes" });
  check("A", "registra a própria presença", !ok.error, ok.error?.message ?? "");
  for (const [who, u] of [["visitante", V], ["A", A]]) {
    const r = await u.c.from("study_presence").select("id").limit(1);
    check(who, "não lê study_presence direto", permError(r), r.error?.message ?? `${rows(r)} linha(s)`);
  }
  const w = await A.c.from("study_presence").insert({ kind: "questoes", started_at: "2026-11-01T00:00:00Z", last_at: "2026-11-01T11:00:00Z" }).select();
  check("A", "não grava horas na mão", permError(w), w.error?.message ?? "gravou!");
}

// ── Clube: dono, convites, membros, cota e conta (sessão 4 do plano v2) ──
{
  const vs = await V.c.rpc("invite_status", { p_code: "AAAAAAAAAA" });
  check("visitante", "consulta um código de convite (só a situação)", !vs.error && vs.data === "invalido", vs.error?.message ?? String(vs.data));
  const vc = await V.c.rpc("create_account_with_invite", { p_email: "ninguem@resolve.test", p_password: "senha-qualquer-1", p_code: "AAAAAAAAAA", p_terms_version: "x" });
  check("visitante", "não cria conta com convite inexistente", !vc.error && vc.data === "convite_invalido", vc.error?.message ?? String(vc.data));
  const vo = await V.c.rpc("club_overview");
  check("visitante", "não lê o clube", denied(vo), vo.error?.message ?? "sem conteúdo");
  for (const [who, u] of [["A", A], ["E", E]]) {
    const own = await u.c.rpc("is_owner");
    check(who, "não é dono", !own.error && own.data === false, own.error?.message ?? String(own.data));
    const ov = await u.c.rpc("club_overview");
    check(who, "não lê o clube (contas e e-mails)", denied(ov), ov.error?.message ?? "sem conteúdo");
    const ci = await u.c.rpc("create_invite", { p_note: "x", p_max_uses: 1, p_days: 1 });
    check(who, "não cria convite", /resolve_not_owner/.test(ci.error?.message ?? ""), ci.error?.message ?? "criou!");
    const ss = await u.c.rpc("set_member_status", { p_user: B.id, p_status: "suspenso" });
    check(who, "não suspende outra conta", /resolve_not_owner/.test(ss.error?.message ?? ""), ss.error?.message ?? "suspendeu!");
    const rm = await u.c.rpc("remove_member", { p_user: B.id });
    check(who, "não remove outra conta", /resolve_not_owner/.test(rm.error?.message ?? ""), rm.error?.message ?? "removeu!");
  }
  for (const t of ["invites"]) {
    const r = await A.c.from(t).select("id").limit(1);
    check("A", `não lê ${t} direto`, permError(r), r.error?.message ?? `${rows(r)} linha(s)`);
  }
  const mm = await A.c.from("members").select("user_id");
  check("A", "em members, só lê a própria linha", !mm.error && (mm.data ?? []).every((x) => x.user_id === A.id), mm.error?.message ?? `${rows(mm)} linha(s)`);
  const ao = await A.c.from("app_owners").select("user_id");
  check("A", "não descobre quem é o dono", !ao.error && rows(ao) === 0, ao.error?.message ?? `${rows(ao)} linha(s)`);
  const ow = await A.c.from("app_owners").insert({ user_id: A.id }).select();
  check("A", "não se torna dono", permError(ow), ow.error?.message ?? "virou dono!");
  const mw = await A.c.from("members").update({ status: "ativo" }).eq("user_id", B.id).select();
  check("A", "não altera members direto", permError(mw) || denied(mw), mw.error?.message ?? `${rows(mw)} linha(s)`);
  const q = await A.c.rpc("my_ai_quota");
  check("A", "consulta a própria cota de IA", !q.error, q.error?.message ?? "");
  const vd = await V.c.rpc("delete_my_account");
  check("visitante", "não chama a exclusão de conta", Boolean(vd.error), vd.error?.message ?? "chamou!");
}

// ── Conferência das anotações e guia de primeiros passos (sessão 3 do plano v2) ──
{
  const vq = await V.c.rpc("annotation_review_queue");
  check("visitante", "não recebe a fila da conferência", denied(vq), vq.error?.message ?? `${rows(vq)} linha(s)`);
  const aq = await A.c.rpc("annotation_review_queue");
  check("A", "não recebe a fila da conferência", denied(aq), aq.error?.message ?? `${rows(aq)} linha(s)`);
  const eq = await E.c.rpc("annotation_review_queue");
  check("E", "recebe a fila da conferência", !eq.error && rows(eq) >= 1, eq.error?.message ?? `${rows(eq)} linha(s)`);
  const one = eq.data?.[0]?.proposal_id;
  const ar = await A.c.rpc("annotation_review", { p_proposal: one });
  check("A", "não abre ficha da conferência (traz o gabarito)", denied(ar), ar.error?.message ?? "sem conteúdo");
  const er = await E.c.rpc("annotation_review", { p_proposal: one });
  check("E", "abre ficha da conferência com gabarito", !er.error && (er.data?.alternatives ?? []).some((x) => x.is_correct === true), er.error?.message ?? "");

  const vg = await V.c.rpc("mark_guide", { p_key: "tour" });
  check("visitante", "não marca o guia", Boolean(vg.error), vg.error?.message ?? "marcou!");
  const bad = await A.c.rpc("mark_guide", { p_key: "admin" });
  check("A", "não grava chave fora do guia", /resolve_guide_key/.test(bad.error?.message ?? ""), bad.error?.message ?? "gravou!");
  const mine = await A.c.rpc("mark_guide", { p_key: "tour" });
  check("A", "marca o próprio guia", !mine.error && typeof mine.data?.tour === "string", mine.error?.message ?? "");
  const other = await A.c.from("profiles").update({ guide: {}, weekly_hours: 1 }).eq("user_id", B.id).select("user_id");
  check("A", "não altera o guia nem as horas de B", denied(other), other.error?.message ?? `${rows(other)} linha(s)`);
  const peek = await A.c.from("profiles").select("guide").eq("user_id", B.id);
  check("A", "não lê o guia de B", denied(peek), peek.error?.message ?? `${rows(peek)} linha(s)`);
  const big = await A.c.from("profiles").update({ guide: { nota: "x".repeat(3000) } }).eq("user_id", A.id).select("user_id");
  check("A", "guia não aceita conteúdo grande", Boolean(big.error), big.error?.message ?? "aceitou!");
  const hours = await A.c.from("profiles").update({ weekly_hours: 200 }).eq("user_id", A.id).select("user_id");
  check("A", "horas por semana fora do intervalo são recusadas", Boolean(hours.error), hours.error?.message ?? "aceitou!");
  const vf = await V.c.rpc("first_question");
  check("visitante", "não recebe a primeira questão", denied(vf), vf.error?.message ?? `${rows(vf)} linha(s)`);
  const af = await A.c.rpc("first_question");
  check("A", "recebe a primeira questão (só o identificador e a área)", !af.error && rows(af) === 1 && Object.keys(af.data[0]).sort().join() === "area,item_version_id", af.error?.message ?? `${rows(af)} linha(s)`);
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
