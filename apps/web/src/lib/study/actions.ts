"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_EVENT_TYPES } from "./events";
import { ERROR_REASONS } from "./reasons";
import { classify, type Outcome } from "./retry";
import type { Explanation } from "./raiox";

/**
 * Ações do ciclo de estudo (F3-T01, F3-T06, F3-T12). A identidade vem da sessão de login; o acerto,
 * a sequência dos eventos e o prazo são do banco. O cliente só informa a escolha e tempos medidos,
 * que o banco limita ao tempo real da sessão.
 */
const uuid = z.string().uuid();

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Outcome<T>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "resolve_not_signed_in", final: true };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, ...classify(error.message) };
  return { ok: true, value: data as T };
}

const startSchema = z.object({
  actionId: uuid,
  mode: z.enum(["treino", "diagnostico", "revisao", "foco", "simulado"]),
  itemVersionIds: z.array(uuid).min(1).max(180),
  plannedMinutes: z.number().int().min(1).max(600).nullable().default(null),
  timeLimitMinutes: z.number().int().min(1).max(600).nullable().default(null),
  selectionReason: z.enum(["escolha", "revisao", "diagnostico", "plano"]).default("escolha"),
});

export async function startSession(input: unknown): Promise<Outcome<string>> {
  const p = startSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const d = p.data;
  return rpc<string>("start_session", {
    p_client_action_id: d.actionId,
    p_mode: d.mode,
    p_item_version_ids: d.itemVersionIds,
    p_planned_minutes: d.plannedMinutes,
    p_time_limit_minutes: d.timeLimitMinutes,
    p_selection_reason: d.selectionReason,
  });
}

const submitSchema = z.object({
  actionId: uuid,
  sessionItemId: uuid,
  alternativeId: uuid,
  confidence: z.number().int().min(1).max(3).nullable().default(null),
  helpSeen: z.boolean().default(false),
  activeMs: z.number().int().min(0).max(86_400_000).nullable().default(null),
  elapsedMs: z.number().int().min(0).max(86_400_000).nullable().default(null),
});

export interface SubmitResult {
  attempt_id: string;
  is_correct: boolean | null;
  correct_alternative_id: string | null;
  is_repeat: boolean;
  help_seen: boolean;
  duplicate: boolean;
  error_entry_id: string | null;
}

/** Confirma a resposta. Reenviar com o mesmo `actionId` devolve a mesma tentativa. */
export async function submitAttempt(input: unknown): Promise<Outcome<SubmitResult>> {
  const p = submitSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const d = p.data;
  const r = await rpc<SubmitResult[]>("submit_attempt", {
    p_client_action_id: d.actionId,
    p_session_item_id: d.sessionItemId,
    p_alternative_id: d.alternativeId,
    p_confidence: d.confidence,
    p_help_seen: d.helpSeen,
    p_active_ms: d.activeMs,
    p_elapsed_ms: d.elapsedMs,
  });
  if (!r.ok) return r;
  const row = r.value[0];
  return row ? { ok: true, value: row } : { ok: false, error: "resposta vazia", final: false };
}

const eventsSchema = z.object({
  sessionId: uuid,
  events: z
    .array(
      z.object({
        client_event_id: z.string().regex(/^[A-Za-z0-9_-]{1,76}$/),
        type: z.enum(CLIENT_EVENT_TYPES),
        session_item_id: uuid.nullable(),
        payload: z.record(z.string(), z.string().max(20)),
        client_at: z.string().datetime(),
      }),
    )
    .max(100),
});

export async function logEvents(input: unknown): Promise<Outcome<{ logged: number; ignored: number; last_sequence: number }>> {
  const p = eventsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "eventos inválidos", final: true };
  const r = await rpc<{ logged: number; ignored: number; last_sequence: number }[]>("log_session_events", {
    p_session_id: p.data.sessionId,
    p_events: p.data.events,
  });
  if (!r.ok) return r;
  return { ok: true, value: r.value[0] ?? { logged: 0, ignored: 0, last_sequence: 0 } };
}

const reasonSchema = z.object({ entryId: uuid, reason: z.enum(ERROR_REASONS.map((r) => r.code) as [string, ...string[]]) });

/** Motivo do erro: opcional, um clique; "não informado" desfaz. */
export async function setErrorReason(input: unknown): Promise<Outcome<string>> {
  const p = reasonSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "motivo inválido", final: true };
  return rpc<string>("set_error_reason", { p_entry_id: p.data.entryId, p_reason: p.data.reason });
}

const statusSchema = z.object({ sessionId: uuid, status: z.enum(["ativa", "pausada", "encerrada"]) });

export async function setSessionStatus(input: unknown): Promise<Outcome<string>> {
  const p = statusSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "estado inválido", final: true };
  return rpc<string>("set_session_status", { p_session_id: p.data.sessionId, p_status: p.data.status });
}

export interface ReviewQueueRow {
  /** Questão (review_items) ou cartão revisado (card_review_items, F3-T09). */
  kind: "questao" | "cartao";
  review_item_id: string;
  item_id: string | null;
  item_version_id: string | null;
  card_id: string | null;
  due_date: string;
  days_overdue: number;
  stage: number;
  queue_position: number;
  in_batch: boolean;
  local_date: string;
  minutes_per_item: number;
}

const queueSchema = z.object({ availableMinutes: z.number().int().min(0).max(600) });

/** Fila de revisão do dia (F3-T07): vencidos primeiro; o tempo disponível define o lote, o resto fica visível. */
export async function reviewQueue(input: unknown): Promise<Outcome<{ rows: ReviewQueueRow[]; inBatch: number; remaining: number }>> {
  const p = queueSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "tempo inválido", final: true };
  const r = await rpc<ReviewQueueRow[]>("review_queue", { p_available_minutes: p.data.availableMinutes });
  if (!r.ok) return r;
  const inBatch = r.value.filter((x) => x.in_batch).length;
  return { ok: true, value: { rows: r.value, inBatch, remaining: r.value.length - inBatch } };
}

const cardReviewSchema = z.object({ actionId: uuid, cardId: uuid, recalled: z.boolean() });

export interface CardReviewResult {
  outcome: "lembrou" | "nao_lembrou" | "antecipada" | "concluida";
  stage: number;
  due_date: string | null;
  duplicate: boolean;
}

/** Revisão de cartão (F3-T09): "lembrei" ou "não lembrei". Gravada à parte das tentativas de questão (fora da TRI). */
export async function reviewCard(input: unknown): Promise<Outcome<CardReviewResult>> {
  const p = cardReviewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const r = await rpc<CardReviewResult[]>("review_card", { p_client_action_id: p.data.actionId, p_card_id: p.data.cardId, p_recalled: p.data.recalled });
  if (!r.ok) return r;
  const row = r.value[0];
  return row ? { ok: true, value: row } : { ok: false, error: "resposta vazia", final: true };
}

/** Põe um cartão publicado na própria fila de revisão (vence no dia seguinte). */
export async function addCardToReview(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ cardId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  return rpc<string>("add_card_to_review", { p_card_id: p.data.cardId });
}

const trainingSchema = z.object({
  actionId: uuid,
  area: z.enum(["todas", "LC", "CH", "CN", "MT"]),
  count: z.number().int().min(1).max(30),
});

/**
 * Treino livre (F3-T02): sorteia questões publicadas (não anuladas) da área, primeiro as que a conta
 * ainda não respondeu, e abre uma sessão com a lista congelada. Reenviar com o mesmo `actionId`
 * devolve a mesma sessão.
 */
export async function startTraining(input: unknown): Promise<Outcome<string>> {
  const p = trainingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "resolve_not_signed_in", final: true };
  let q = supabase.from("study_items").select("item_version_id").eq("annulled", false);
  if (p.data.area !== "todas") q = q.eq("area", p.data.area);
  const [{ data: pool }, { data: done }] = await Promise.all([q, supabase.from("attempts").select("item_version_id")]);
  const answered = new Set((done ?? []).map((a) => a.item_version_id));
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const ids = (pool ?? []).map((r) => r.item_version_id as string);
  const chosen = [...shuffle(ids.filter((i) => !answered.has(i))), ...shuffle(ids.filter((i) => answered.has(i)))].slice(0, p.data.count);
  if (!chosen.length) return { ok: false, error: "resolve_no_items", final: true };
  return rpc<string>("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "treino",
    p_item_version_ids: chosen,
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "escolha",
  });
}

/**
 * Diagnóstico opcional por área: abre uma sessão no modo "diagnostico" com até 20 questões publicadas
 * da área, priorizando as que têm parâmetro válido no modelo registrado (só elas entram na estimativa)
 * e as ainda não respondidas. Sem questões publicadas da área, não abre.
 */
export async function startDiagnostic(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ actionId: uuid, area: z.enum(["LC", "CH", "CN", "MT"]) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "resolve_not_signed_in", final: true };
  const [{ data: pool }, { data: done }, { data: withParams }] = await Promise.all([
    supabase.from("study_items").select("item_version_id, item_id").eq("annulled", false).eq("area", p.data.area),
    supabase.from("attempts").select("item_id"),
    supabase.from("item_parameters").select("item_id").eq("valid", true),
  ]);
  const answered = new Set((done ?? []).map((a) => a.item_id));
  const param = new Set((withParams ?? []).map((x) => x.item_id));
  const rank = (r: { item_id: string }) => (param.has(r.item_id) ? 0 : 2) + (answered.has(r.item_id) ? 1 : 0);
  const chosen = (pool ?? [])
    .map((r) => [rank(r as { item_id: string }) + Math.random(), r.item_version_id as string] as const)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 20)
    .map(([, id]) => id);
  if (!chosen.length) return { ok: false, error: "resolve_no_items", final: true };
  return rpc<string>("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "diagnostico",
    p_item_version_ids: chosen,
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "diagnostico",
  });
}

/** Raio-X (F3-T04): só vem conteúdo depois da resposta ou da ajuda pedida; antes, `released: false`. */
export async function getExplanation(input: unknown): Promise<Outcome<Explanation>> {
  const p = z.object({ sessionItemId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  return rpc<Explanation>("item_explanation", { p_session_item_id: p.data.sessionItemId });
}

/** Ajuda explícita antes de responder: registra `ajuda_vista` (a tentativa fica marcada como feita com ajuda). */
export async function requestHelp(input: unknown): Promise<Outcome<Explanation>> {
  const p = z.object({ sessionId: uuid, sessionItemId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const event = { client_event_id: `ajuda-${p.data.sessionItemId}`, type: "ajuda_vista", session_item_id: p.data.sessionItemId, payload: {}, client_at: new Date().toISOString() };
  const logged = await rpc<unknown>("log_session_events", { p_session_id: p.data.sessionId, p_events: [event] });
  if (!logged.ok) return logged;
  return rpc<Explanation>("item_explanation", { p_session_item_id: p.data.sessionItemId });
}

/**
 * Revisão do dia (F3-T08): abre uma sessão de revisão com as questões do lote (fila do banco, sem
 * seleção manual). A confirmação de cada resposta atualiza a agenda; ajuda e repetição ficam na tentativa.
 */
export async function startReview(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ actionId: uuid, availableMinutes: z.number().int().min(1).max(600) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const q = await rpc<ReviewQueueRow[]>("review_queue", { p_available_minutes: p.data.availableMinutes });
  if (!q.ok) return q;
  const ids = q.value.filter((r) => r.in_batch && r.kind === "questao" && r.item_version_id).map((r) => r.item_version_id!);
  if (!ids.length) return { ok: false, error: "resolve_no_items", final: true };
  return rpc<string>("start_session", { p_client_action_id: p.data.actionId, p_mode: "revisao", p_item_version_ids: ids, p_planned_minutes: p.data.availableMinutes, p_time_limit_minutes: null, p_selection_reason: "revisao" });
}

/** Resolver as questões filtradas no banco (F3-T10): até 30, sorteadas; o banco só aceita publicadas. */
export async function startWithItems(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ actionId: uuid, itemVersionIds: z.array(uuid).min(1).max(500) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const ids = [...new Set(p.data.itemVersionIds)].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x).slice(0, 30);
  return rpc<string>("start_session", { p_client_action_id: p.data.actionId, p_mode: "treino", p_item_version_ids: ids, p_planned_minutes: null, p_time_limit_minutes: null, p_selection_reason: "escolha" });
}

export interface TriageResult { decision: "agora" | "depois" | "chuto"; visible_ms: number; window_closed: boolean; duplicate: boolean }

/** Triagem (F4-T04): grava a decisão com o tempo visível. Reenviar com a mesma ação devolve a mesma decisão. */
export async function recordTriage(input: unknown): Promise<Outcome<TriageResult>> {
  const p = z.object({ actionId: uuid, sessionItemId: uuid, decision: z.enum(["agora", "depois", "chuto"]), visibleMs: z.number().int().min(0).max(600000) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const r = await rpc<TriageResult[]>("record_triage", { p_client_action_id: p.data.actionId, p_session_item_id: p.data.sessionItemId, p_decision: p.data.decision, p_visible_ms: p.data.visibleMs });
  if (!r.ok) return r;
  const row = r.value[0];
  return row ? { ok: true, value: row } : { ok: false, error: "resposta vazia", final: true };
}

/**
 * Bloco de ritmo (F4-T06): sessão com prazo (modo simulado, sem pausa) e questões publicadas sorteadas,
 * primeiro as não respondidas. O número de questões vem do alvo por questão.
 */
export async function startRhythm(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ actionId: uuid, minutes: z.union([z.literal(15), z.literal(45), z.literal(90), z.literal(180)]), count: z.number().int().min(1).max(180) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "resolve_not_signed_in", final: true };
  const [{ data: pool }, { data: done }] = await Promise.all([supabase.from("study_items").select("item_version_id").eq("annulled", false), supabase.from("attempts").select("item_version_id")]);
  const answered = new Set((done ?? []).map((a) => a.item_version_id));
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const ids = (pool ?? []).map((r) => r.item_version_id as string);
  const chosen = [...shuffle(ids.filter((i) => !answered.has(i))), ...shuffle(ids.filter((i) => answered.has(i)))].slice(0, p.data.count);
  if (!chosen.length) return { ok: false, error: "resolve_no_items", final: true };
  return rpc<string>("start_session", { p_client_action_id: p.data.actionId, p_mode: "simulado", p_item_version_ids: chosen, p_planned_minutes: p.data.minutes, p_time_limit_minutes: p.data.minutes, p_selection_reason: "escolha" });
}

/**
 * Treinos de habilidade (comando primeiro, caça ao distrator): sessão de treino com até 5 questões da
 * área, marcada com o treino. Comando primeiro prefere questões com texto-base para marcar evidência.
 */
export async function startSkill(input: unknown): Promise<Outcome<string>> {
  const p = z
    .object({ actionId: uuid, skill: z.enum(["comando", "distrator"]), area: z.enum(["LC", "CH", "CN", "MT", "todas"]) })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "resolve_not_signed_in", final: true };
  let q = supabase.from("study_items").select("item_version_id, stimulus_blocks").eq("annulled", false);
  if (p.data.area !== "todas") q = q.eq("area", p.data.area);
  const [{ data: pool }, { data: done }] = await Promise.all([q, supabase.from("attempts").select("item_version_id")]);
  const answered = new Set((done ?? []).map((a) => a.item_version_id));
  const hasText = (r: { stimulus_blocks: unknown }) =>
    Array.isArray(r.stimulus_blocks) && (r.stimulus_blocks as { type: string; text?: string }[]).some((b) => b.type === "paragraph" && (b.text ?? "").length > 80);
  const ranked = (pool ?? [])
    .filter((r) => p.data.skill === "distrator" || hasText(r))
    .map((r) => [(answered.has(r.item_version_id) ? 1 : 0) + Math.random(), r.item_version_id as string] as const)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 5)
    .map(([, id]) => id);
  if (!ranked.length) return { ok: false, error: "resolve_no_items", final: true };
  const s = await rpc<string>("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "treino",
    p_item_version_ids: ranked,
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "escolha",
  });
  if (!s.ok) return s;
  await supabase.rpc("set_session_skill", { p_session: s.value, p_skill: p.data.skill });
  return s;
}

const rangeSchema = z.object({
  block_id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  start_utf16: z.number().int().min(0),
  end_utf16: z.number().int().min(1),
  quote: z.string().max(2000).optional(),
});

/** Comando primeiro: grava a evidência marcada antes da resposta (até 3 trechos, ou o motivo de não haver). */
export async function recordEvidence(input: unknown): Promise<Outcome<unknown>> {
  const p = z
    .object({ sessionItemId: uuid, ranges: z.array(rangeSchema).max(3), noneReason: z.enum(["figura", "calculo", "nao_encontrei"]).nullable() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  return rpc<unknown>("record_evidence", { p_session_item: p.data.sessionItemId, p_ranges: p.data.ranges, p_none_reason: p.data.noneReason });
}

/** Caça ao distrator: grava a classificação das alternativas erradas depois da resposta. */
export async function recordDistractorChoices(input: unknown): Promise<Outcome<unknown>> {
  const p = z
    .object({
      sessionItemId: uuid,
      choices: z.array(z.object({ key: z.string().min(1).max(4), type: z.string().regex(/^[a-z_]{3,40}$/), justification: z.string().max(500).optional() })).min(1).max(4),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  return rpc<unknown>("record_distractor_choices", { p_session_item: p.data.sessionItemId, p_choices: p.data.choices });
}

export interface SkillFeedback {
  released: boolean;
  annotation_status?: "aprovadas" | "pendentes";
  correct_key?: string;
  my_evidence?: { ranges: { block_id: string; start_utf16: number; end_utf16: number; quote?: string }[]; none_reason: string | null } | null;
  my_choices?: { key: string; type: string; justification?: string }[] | null;
  evidence?: { block_id: string; start_utf16: number; end_utf16: number; rationale: string | null }[] | null;
  distractors?: { key: string; type: string; label: string; rationale: string }[] | null;
}

export async function getSkillFeedback(input: unknown): Promise<Outcome<SkillFeedback>> {
  const p = z.object({ sessionItemId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  return rpc<SkillFeedback>("skill_feedback", { p_session_item: p.data.sessionItemId });
}

/**
 * Questão do dia: confere no servidor que a questão pedida é mesmo a do dia (fuso do perfil) e abre
 * uma sessão de uma questão. Reenviar com o mesmo `actionId` devolve a mesma sessão.
 */
export async function startDailyQuestion(input: unknown): Promise<Outcome<string>> {
  const p = z.object({ actionId: uuid, itemVersionId: uuid, today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados inválidos", final: true };
  const supabase = await createClient();
  const { data } = await supabase.rpc("daily_question", { p_local_date: p.data.today });
  const row = (data as { item_version_id: string }[] | null)?.[0];
  if (!row || row.item_version_id !== p.data.itemVersionId) return { ok: false, error: "resolve_no_items", final: true };
  return rpc<string>("start_session", {
    p_client_action_id: p.data.actionId,
    p_mode: "treino",
    p_item_version_ids: [row.item_version_id],
    p_planned_minutes: null,
    p_time_limit_minutes: null,
    p_selection_reason: "plano",
  });
}
