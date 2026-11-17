import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface InviteRow {
  id: string;
  code: string;
  note: string;
  maxUses: number;
  uses: number;
  expiresAt: string;
  state: "ok" | "invalido" | "expirado" | "usado" | "cheio";
}

export interface AccountRow {
  userId: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  kind: "dono" | "convidado" | "anterior";
  status: "ativo" | "suspenso" | "removendo";
  me: boolean;
  aiLimitUsd: number | null;
  aiConsumedUsd: number;
  aiReservedUsd: number;
}

export interface Club {
  seatsLeft: number;
  invites: InviteRow[];
  accounts: AccountRow[];
}

/** Página do clube: só o dono. Quem não é dono recebe 404, sem saber que a página existe. */
export async function requireOwner() {
  if (!authEnabled) notFound();
  const supabase = await createClient();
  const { data: owner } = await supabase.rpc("is_owner");
  if (owner !== true) notFound();
  return supabase;
}

export async function currentUserIsOwner(): Promise<boolean> {
  if (!authEnabled) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_owner");
  return data === true;
}

export async function loadClub(): Promise<Club> {
  const supabase = await requireOwner();
  const { data, error } = await supabase.rpc("club_overview");
  if (error || !data) throw new Error(`clube: ${error?.message ?? "sem dados"}`);
  const raw = data as {
    seats_left: number;
    invites: { id: string; code: string; note: string; max_uses: number; uses: number; expires_at: string; state: InviteRow["state"] }[];
    accounts: {
      user_id: string; email: string; created_at: string; last_sign_in_at: string | null; kind: AccountRow["kind"]; status: AccountRow["status"];
      me: boolean; ai_limit_usd: number | null; ai_consumed_usd: number; ai_reserved_usd: number;
    }[];
  };
  return {
    seatsLeft: raw.seats_left,
    invites: raw.invites.map((i) => ({ id: i.id, code: i.code, note: i.note, maxUses: i.max_uses, uses: i.uses, expiresAt: i.expires_at, state: i.state })),
    accounts: raw.accounts.map((a) => ({
      userId: a.user_id, email: a.email, createdAt: a.created_at, lastSignInAt: a.last_sign_in_at, kind: a.kind, status: a.status, me: a.me,
      aiLimitUsd: a.ai_limit_usd === null ? null : Number(a.ai_limit_usd), aiConsumedUsd: Number(a.ai_consumed_usd), aiReservedUsd: Number(a.ai_reserved_usd),
    })),
  };
}

export interface MyAccount {
  email: string;
  owner: boolean;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  quota: { limitUsd: number; warnRatio: number; consumedUsd: number; reservedUsd: number } | null;
}

/** Conta e dados: e-mail, aceite dos termos e cota de IA do mês; null sem sessão. */
export async function loadMyAccount(): Promise<MyAccount | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: owner }, { data: member }, { data: quota }] = await Promise.all([
    supabase.rpc("is_owner"),
    supabase.from("members").select("terms_version, terms_accepted_at").eq("user_id", auth.user.id).maybeSingle(),
    supabase.rpc("my_ai_quota"),
  ]);
  const q = quota as { limit_usd: number; warn_ratio: number; consumed_usd: number; reserved_usd: number } | null;
  return {
    email: auth.user.email ?? "",
    owner: owner === true,
    termsVersion: (member?.terms_version as string | null) ?? null,
    termsAcceptedAt: (member?.terms_accepted_at as string | null) ?? null,
    quota: q ? { limitUsd: Number(q.limit_usd), warnRatio: Number(q.warn_ratio), consumedUsd: Number(q.consumed_usd), reservedUsd: Number(q.reserved_usd) } : null,
  };
}
