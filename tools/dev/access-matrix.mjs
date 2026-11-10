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
  check("E", "lê o rascunho do tema oficial", Boolean(draftId), draft.error?.message ?? "nenhum rascunho");
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
