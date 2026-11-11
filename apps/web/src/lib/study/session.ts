import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadQuestionAssets } from "./question-assets";
import { markSharedTexts } from "./shared-text";
import {
  fromStudyItem,
  type StudyItemRow,
  type StudyQuestion,
} from "./question-types";

export interface SessionEntry {
  sessionItemId: string;
  itemVersionId: string;
  /** Decisão da triagem (F4-T04), se houve. */
  triage: {
    decision: "agora" | "depois" | "chuto";
    visible_ms: number;
    window_closed: boolean;
  } | null;
  position: number;
  question: StudyQuestion;
  /** Chave estável → id da alternativa (o envio usa o id). */
  alternativeIds: Record<string, string>;
  feedback: {
    chosenKey: string | null;
    correctKey: string | null;
    isCorrect: boolean | null;
    errorEntryId: string | null;
    reason: string | null;
  } | null;
}

export interface SessionView {
  id: string;
  mode: string;
  status: string;
  deadlineAt: string | null;
  /** Questões marcadas para revisar (último evento de marcação de cada uma). */
  marked: string[];
  entries: SessionEntry[];
}

/** Questões publicadas por área (para oferecer o treino). */
export async function publishedByArea(): Promise<Record<
  string,
  number
> | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("study_items")
    .select("area")
    .eq("annulled", false);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.area] = (out[r.area] ?? 0) + 1;
  return out;
}

/** Sessão da conta do login, com as questões (sem gabarito) e o retorno das já respondidas. */
export async function loadSession(id: string): Promise<SessionView> {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("study_sessions")
    .select("id, mode, status, deadline_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();
  const { data: items } = await supabase
    .from("session_items")
    .select("id, position, item_version_id")
    .eq("session_id", id)
    .order("position");
  const versionIds = (items ?? []).map((i) => i.item_version_id);
  const [
    { data: study },
    { data: alts },
    { data: feedback },
    { data: triage },
  ] = await Promise.all([
    supabase
      .from("study_items")
      .select(
        "item_version_id, area, stimulus_blocks, command_blocks, alternatives, appearances, stimulus_version_id",
      )
      .in("item_version_id", versionIds),
    supabase
      .from("alternatives")
      .select("id, item_version_id, stable_key")
      .in("item_version_id", versionIds),
    supabase.rpc("session_feedback", { p_session_id: id }),
    supabase
      .from("triage_decisions")
      .select("session_item_id, decision, visible_ms, window_closed")
      .in(
        "session_item_id",
        (items ?? []).map((i) => i.id),
      ),
  ]);
  const assets = await loadQuestionAssets(supabase, (study ?? []) as StudyItemRow[]);
  const byVersion = new Map(
    ((study ?? []) as StudyItemRow[]).map((s) => [s.item_version_id, s]),
  );
  const fb = new Map(
    (feedback ?? []).map((f: { session_item_id: string }) => [
      f.session_item_id,
      f,
    ]),
  );
  const entries: SessionEntry[] = [];
  for (const it of items ?? []) {
    const row = byVersion.get(it.item_version_id);
    if (!row) continue; // versão despublicada: não aparece
    const ids: Record<string, string> = {};
    const keyById: Record<string, string> = {};
    for (const a of alts ?? [])
      if (a.item_version_id === it.item_version_id) {
        ids[a.stable_key] = a.id;
        keyById[a.id] = a.stable_key;
      }
    const f = fb.get(it.id) as
      | {
          chosen_alternative_id: string | null;
          correct_alternative_id: string | null;
          is_correct: boolean | null;
          error_entry_id: string | null;
          error_reason: string | null;
        }
      | undefined;
    entries.push({
      sessionItemId: it.id,
      itemVersionId: it.item_version_id,
      triage:
        (
          (triage ?? []) as {
            session_item_id: string;
            decision: "agora" | "depois" | "chuto";
            visible_ms: number;
            window_closed: boolean;
          }[]
        ).find((t) => t.session_item_id === it.id) ?? null,
      position: it.position,
      question: fromStudyItem(row, assets),
      alternativeIds: ids,
      feedback: f
        ? {
            chosenKey: f.chosen_alternative_id
              ? (keyById[f.chosen_alternative_id] ?? null)
              : null,
            correctKey: f.correct_alternative_id
              ? (keyById[f.correct_alternative_id] ?? null)
              : null,
            isCorrect: f.is_correct,
            errorEntryId: f.error_entry_id,
            reason: f.error_reason,
          }
        : null,
    });
  }
  markSharedTexts(entries, byVersion);
  const { data: marks } = await supabase
    .from("attempt_events")
    .select("session_item_id, event_type, sequence")
    .eq("session_id", id)
    .in("event_type", ["marcada_para_revisar", "desmarcada_para_revisar"])
    .order("sequence");
  const last = new Map<string, string>();
  for (const e of marks ?? [])
    if (e.session_item_id) last.set(e.session_item_id, e.event_type);
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    deadlineAt: session.deadline_at,
    marked: [...last]
      .filter(([, t]) => t === "marcada_para_revisar")
      .map(([k]) => k),
    entries,
  };
}
