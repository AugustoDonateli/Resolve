"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TRACK } from "./track";

export async function setTrackStep(input: unknown): Promise<{ ok: boolean }> {
  const p = z.object({ step: z.enum(TRACK.map((s) => s.id) as [string, ...string[]]), done: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { error } = await supabase
    .from("essay_track_progress")
    .upsert({ user_id: auth.user.id, step: p.data.step, done: p.data.done, updated_at: new Date().toISOString() });
  revalidatePath("/redacao/trilha");
  revalidatePath("/redacao");
  return { ok: !error };
}
