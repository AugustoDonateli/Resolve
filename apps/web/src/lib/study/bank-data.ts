import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { BankItem } from "./bank";

/** Itens publicados com habilidade e assunto aprovados (as políticas do banco só mostram publicados). */
export async function loadBank(): Promise<BankItem[] | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: items } = await supabase
    .from("study_items")
    .select("item_version_id, area, command_blocks, appearances")
    .eq("annulled", false);
  const ids = (items ?? []).map((i) => i.item_version_id as string);
  if (!ids.length) return [];
  const [{ data: sk }, { data: su }] = await Promise.all([
    supabase
      .from("item_skill_tags")
      .select("item_version_id, skills(code)")
      .eq("review_status", "aprovada")
      .in("item_version_id", ids),
    supabase
      .from("item_subject_tags")
      .select("item_version_id, subjects(id, label)")
      .eq("review_status", "aprovada")
      .in("item_version_id", ids),
  ]);
  const skills = new Map<string, string[]>();
  for (const r of sk ?? []) {
    const code = (r.skills as unknown as { code: string } | null)?.code;
    if (code)
      skills.set(r.item_version_id, [
        ...(skills.get(r.item_version_id) ?? []),
        code,
      ]);
  }
  const subjects = new Map<string, { id: string; name: string }[]>();
  for (const r of su ?? []) {
    const s = r.subjects as unknown as { id: string; label: string } | null;
    if (s)
      subjects.set(r.item_version_id, [
        ...(subjects.get(r.item_version_id) ?? []),
        { id: s.id, name: s.label },
      ]);
  }
  return (items ?? []).map((i) => {
    const cmd =
      (i.command_blocks as { text?: string }[] | null)?.find((b) => b.text)
        ?.text ?? "";
    return {
      itemVersionId: i.item_version_id,
      area: i.area,
      skills: skills.get(i.item_version_id) ?? [],
      subjects: subjects.get(i.item_version_id) ?? [],
      origins: (i.appearances as BankItem["origins"] | null) ?? [],
      preview: cmd.length > 160 ? `${cmd.slice(0, 157)}…` : cmd,
    };
  });
}
