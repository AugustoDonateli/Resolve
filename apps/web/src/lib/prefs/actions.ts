"use server";

import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { prefsSchema, prefsToRow, rowToPrefs, type PrefsInput } from "./schema";

/** Lê as preferências da conta; null sem sessão ou em modo local. */
export async function loadPreferences(): Promise<PrefsInput | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("user_preferences").select("theme, reduced_motion, text_scale").eq("user_id", user.id).maybeSingle();
  return data ? rowToPrefs(data) : null;
}

/** Grava as preferências da conta. A identidade vem da sessão, nunca do cliente. */
export async function savePreferences(input: unknown): Promise<{ ok: boolean }> {
  if (!authEnabled) return { ok: false };
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("user_preferences").update(prefsToRow(parsed.data)).eq("user_id", user.id);
  return { ok: !error };
}
