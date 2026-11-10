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
