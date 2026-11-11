import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface GroupSummary {
  id: string;
  name: string;
  members: number;
}

export interface DuelPlayer {
  nickname: string;
  me: boolean;
  answered: number;
  correct: number | null;
  finished: boolean;
}

export interface DuelBoard {
  id: string;
  groupId: string;
  area: "LC" | "CH" | "CN" | "MT" | null;
  total: number;
  closesAt: string;
  open: boolean;
  revealed: boolean;
  mySession: string | null;
  players: DuelPlayer[];
}

export interface GroupView {
  id: string;
  name: string;
  inviteCode: string;
  members: { nickname: string; me: boolean }[];
  duels: DuelBoard[];
}

/** Grupos de que a conta participa (null sem conta). */
export async function loadMyGroups(): Promise<GroupSummary[] | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("study_groups").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("study_group_members").select("group_id").is("left_at", null),
  ]);
  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    members: (members ?? []).filter((m) => m.group_id === g.id).length,
  }));
}

const toBoard = (j: Record<string, unknown>): DuelBoard => ({
  id: j.id as string,
  groupId: j.group_id as string,
  area: (j.area as DuelBoard["area"]) ?? null,
  total: j.total as number,
  closesAt: j.closes_at as string,
  open: j.open as boolean,
  revealed: j.revealed as boolean,
  mySession: (j.my_session as string | null) ?? null,
  players: (j.players as DuelPlayer[]) ?? [],
});

/** Grupo com membros (apelidos) e os duelos mais recentes; 404 para quem não é membro. */
export async function loadGroup(id: string): Promise<GroupView> {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();
  const { data: group } = await supabase.from("study_groups").select("id, name, invite_code").eq("id", id).maybeSingle();
  if (!group) notFound();
  const [{ data: members }, { data: duels }] = await Promise.all([
    supabase.from("study_group_members").select("user_id, nickname, joined_at").eq("group_id", id).is("left_at", null).order("joined_at"),
    supabase.from("duels").select("id").eq("group_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const boards = await Promise.all(
    (duels ?? []).map(async (d) => {
      const { data } = await supabase.rpc("duel_board", { p_duel: d.id });
      return data ? toBoard(data as Record<string, unknown>) : null;
    }),
  );
  return {
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    members: (members ?? []).map((m) => ({ nickname: m.nickname, me: m.user_id === auth.user!.id })),
    duels: boards.filter((b): b is DuelBoard => b !== null),
  };
}

export async function loadDuel(id: string): Promise<{ board: DuelBoard; groupName: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duel_board", { p_duel: id });
  if (error || !data) notFound();
  const board = toBoard(data as Record<string, unknown>);
  const { data: g } = await supabase.from("study_groups").select("name").eq("id", board.groupId).maybeSingle();
  return { board, groupName: g?.name ?? "Grupo" };
}
