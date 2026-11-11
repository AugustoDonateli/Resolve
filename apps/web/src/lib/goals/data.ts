import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { CourseGoal } from "./course";

/** Metas de curso ativas da conta (null sem conta). */
export async function loadCourseGoals(): Promise<CourseGoal[] | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("course_goals")
    .select("id, course, institution, modality, cutoff, weights, source")
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []).map((g) => ({ ...g, cutoff: g.cutoff === null ? null : Number(g.cutoff) })) as CourseGoal[];
}
