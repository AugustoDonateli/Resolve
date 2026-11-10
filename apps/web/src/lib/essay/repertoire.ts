import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { RepertoireItem } from "./repertoire-types";

export type { RepertoireItem } from "./repertoire-types";

export async function loadRepertoire(): Promise<{ items: RepertoireItem[]; axes: string[] } | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: items }, { data: axes }] = await Promise.all([
    supabase.from("repertoire_items").select("id, kind, content, origin, source, axes, use_note, archived_at, created_at").order("created_at", { ascending: false }),
    supabase.from("essay_axes").select("label").order("label"),
  ]);
  return { items: (items ?? []) as RepertoireItem[], axes: (axes ?? []).map((a) => a.label) };
}
