import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  fromStudyItem,
  type StudyItemRow,
  type StudyQuestion,
} from "./question-types";

export interface SessionEntry {
  sessionItemId: string;
  itemVersionId: string;
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
    .select("id, mode, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();
  const { data: items } = await supabase
    .from("session_items")
    .select("id, position, item_version_id")
    .eq("session_id", id)
    .order("position");
  const versionIds = (items ?? []).map((i) => i.item_version_id);
  const [{ data: study }, { data: alts }, { data: feedback }] =
    await Promise.all([
      supabase
        .from("study_items")
        .select(
          "item_version_id, area, stimulus_blocks, command_blocks, alternatives, appearances",
        )
        .in("item_version_id", versionIds),
      supabase
        .from("alternatives")
        .select("id, item_version_id, stable_key")
        .in("item_version_id", versionIds),
      supabase.rpc("session_feedback", { p_session_id: id }),
    ]);
  // Figuras publicadas: asset_id dos blocos → link assinado (bucket privado, política só para figuras publicadas).
  const assetIds = new Set<string>();
  const walk = (blocks: { asset_id?: string }[] | null | undefined) =>
    blocks?.forEach((b) => b.asset_id && assetIds.add(b.asset_id));
  for (const s of (study ?? []) as StudyItemRow[]) {
    walk(s.stimulus_blocks);
    walk(s.command_blocks);
    s.alternatives.forEach((a) => walk(a.content_blocks));
  }
  const assets: Record<string, { url: string | null; alt: string | null }> = {};
  if (assetIds.size) {
    const { data: rows } = await supabase
      .from("assets")
      .select("id, storage_path, alt_text")
      .in("id", [...assetIds]);
    const paths = (rows ?? []).map((r) => r.storage_path);
    const { data: signed } = paths.length
      ? await supabase.storage
          .from("editorial")
          .createSignedUrls(paths, 60 * 60)
      : { data: [] };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const r of rows ?? [])
      assets[r.id] = {
        url: urlByPath.get(r.storage_path) ?? null,
        alt: r.alt_text ?? null,
      };
  }
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
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    entries,
  };
}
