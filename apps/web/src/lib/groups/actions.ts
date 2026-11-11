"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = string> = { ok: true; value: T } | { ok: false; message: string };

const MSG: [RegExp, string][] = [
  [/resolve_group_not_found/, "Código não encontrado. Confira as 8 letras e números."],
  [/resolve_group_full/, "O grupo já tem 30 pessoas."],
  [/resolve_group_limit/, "Você já criou 10 grupos."],
  [/resolve_no_items/, "Ainda não há questões publicadas suficientes para esse duelo."],
  [/resolve_duel_closed/, "Esse duelo já fechou."],
  [/resolve_not_member|resolve_duel_not_found/, "Você não participa deste grupo."],
  [/check constraint|text_is_safe/, "Use de 2 a 30 caracteres no apelido e de 2 a 60 no nome do grupo."],
];
const explain = (m: string) => MSG.find(([re]) => re.test(m))?.[1] ?? "Não foi possível agora. Tente de novo.";

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para usar os grupos." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: explain(error.message) };
  return { ok: true, value: data as T };
}

const nickname = z.string().trim().min(2).max(30);

export async function createGroup(input: unknown): Promise<Result> {
  const p = z.object({ name: z.string().trim().min(2).max(60), nickname }).safeParse(input);
  if (!p.success) return { ok: false, message: "Use de 2 a 60 caracteres no nome e de 2 a 30 no apelido." };
  const r = await call<string>("create_group", { p_name: p.data.name, p_nickname: p.data.nickname });
  if (r.ok) revalidatePath("/grupos");
  return r;
}

export async function joinGroup(input: unknown): Promise<Result> {
  const p = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{8}$/), nickname }).safeParse(input);
  if (!p.success) return { ok: false, message: "O código tem 8 letras e números; o apelido, de 2 a 30 caracteres." };
  const r = await call<string>("join_group", { p_code: p.data.code, p_nickname: p.data.nickname });
  if (r.ok) revalidatePath("/grupos");
  return r;
}

export async function leaveGroup(input: unknown): Promise<Result<null>> {
  const p = z.object({ groupId: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const r = await call<null>("leave_group", { p_group: p.data.groupId });
  if (r.ok) revalidatePath("/grupos");
  return r.ok ? { ok: true, value: null } : r;
}

export async function createDuel(input: unknown): Promise<Result> {
  const p = z
    .object({ groupId: z.string().uuid(), area: z.enum(["todas", "LC", "CH", "CN", "MT"]), count: z.union([z.literal(5), z.literal(10)]) })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const r = await call<string>("create_duel", { p_group: p.data.groupId, p_area: p.data.area === "todas" ? null : p.data.area, p_count: p.data.count });
  if (r.ok) revalidatePath(`/grupos/${p.data.groupId}`);
  return r;
}

/** Entra no duelo (abre a sessão com as questões congeladas) e devolve a sessão. */
export async function startDuel(input: unknown): Promise<Result> {
  const p = z.object({ duelId: z.string().uuid(), actionId: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  return call<string>("start_duel", { p_duel: p.data.duelId, p_client_action_id: p.data.actionId });
}
