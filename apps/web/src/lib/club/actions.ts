"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAccountMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { confirmsDeletion, normalizeCode } from "./rules";
import { removePersonalFiles } from "./storage";
import { TERMS_VERSION } from "./terms";

type Result<T = null> = { ok: true; value: T } | { ok: false; message: string };

const MSG: [RegExp, string][] = [
  [/resolve_not_owner/, "Só o dono do clube faz isso."],
  [/resolve_invite_invalid/, "O convite vale de 1 a 5 usos e de 1 a 30 dias."],
  [/resolve_invite_limit/, "Já há 10 convites abertos. Cancele um para criar outro."],
  [/resolve_member_invalid/, "Não dá para fazer isso com esta conta."],
  [/resolve_owner_cannot_leave/, "A conta do dono não é excluída pela tela."],
  [/check constraint|text_is_safe/, "Use até 80 caracteres na anotação, sem símbolos especiais."],
];
const explain = (m: string) => MSG.find(([re]) => re.test(m))?.[1] ?? "Não foi possível agora. Tente de novo.";

// ── Convite: criar a conta ──
export interface InviteState {
  email: string;
  error?: string;
}

const signup = z.object({
  code: z.string().min(4).max(20),
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "Use até 72 caracteres na senha."),
  terms: z.literal("on", { message: "Para criar a conta, leia e aceite os termos." }),
});

/** Cria a conta com o convite, com o aceite da versão atual dos termos, e já entra. */
export async function signUpWithInvite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const raw = { code: String(form.get("code") ?? ""), email: String(form.get("email") ?? ""), password: form.get("password"), terms: form.get("terms") };
  const p = signup.safeParse(raw);
  if (!p.success) return { email: raw.email, error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_account_with_invite", {
    p_email: p.data.email,
    p_password: p.data.password,
    p_code: normalizeCode(p.data.code),
    p_terms_version: TERMS_VERSION,
  });
  if (error) {
    const m = /resolve_signup_(\w+)/.exec(error.message)?.[1];
    return { email: p.data.email, error: createAccountMessage(m ?? "") };
  }
  if (data !== "ok") return { email: p.data.email, error: createAccountMessage(String(data)) };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
  if (signInError) redirect("/entrar");
  redirect("/hoje");
}

// ── Dono: convites e contas ──
export async function createInvite(input: unknown): Promise<Result<string>> {
  const p = z.object({ note: z.string().trim().max(80), maxUses: z.number().int().min(1).max(5), days: z.number().int().min(1).max(30) }).safeParse(input);
  if (!p.success) return { ok: false, message: "O convite vale de 1 a 5 usos e de 1 a 30 dias." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", { p_note: p.data.note, p_max_uses: p.data.maxUses, p_days: p.data.days });
  if (error) return { ok: false, message: explain(error.message) };
  revalidatePath("/mais/clube");
  return { ok: true, value: data as string };
}

export async function revokeInvite(input: unknown): Promise<Result> {
  const p = z.object({ id: z.uuid() }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite: p.data.id });
  if (error) return { ok: false, message: explain(error.message) };
  revalidatePath("/mais/clube");
  return { ok: true, value: null };
}

export async function setMemberStatus(input: unknown): Promise<Result> {
  const p = z.object({ userId: z.uuid(), status: z.enum(["ativo", "suspenso"]) }).safeParse(input);
  if (!p.success) return { ok: false, message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", { p_user: p.data.userId, p_status: p.data.status });
  if (error) return { ok: false, message: explain(error.message) };
  revalidatePath("/mais/clube");
  return { ok: true, value: null };
}

/**
 * Remover com exclusão dos dados: a conta é bloqueada (em remoção), os arquivos pessoais são apagados e então a
 * conta sai, levando em cascata todos os dados. Se os arquivos falham, a conta fica bloqueada e nada mais muda.
 */
export async function removeMember(input: unknown): Promise<Result<number>> {
  const p = z.object({ userId: z.uuid(), confirm: z.string() }).safeParse(input);
  if (!p.success || !confirmsDeletion(p.data.confirm)) return { ok: false, message: "Digite EXCLUIR para confirmar." };
  const supabase = await createClient();
  const { error: e1 } = await supabase.rpc("set_member_status", { p_user: p.data.userId, p_status: "removendo" });
  if (e1) return { ok: false, message: explain(e1.message) };
  let files = 0;
  try {
    files = await removePersonalFiles(supabase, p.data.userId);
  } catch {
    revalidatePath("/mais/clube");
    return { ok: false, message: "A conta foi bloqueada, mas os arquivos não puderam ser apagados agora. Tente remover de novo." };
  }
  const { error: e2 } = await supabase.rpc("remove_member", { p_user: p.data.userId });
  if (e2) return { ok: false, message: explain(e2.message) };
  revalidatePath("/mais/clube");
  return { ok: true, value: files };
}

// ── A própria conta ──
/** Excluir a própria conta: apaga os arquivos, depois a conta (e, em cascata, todos os dados) e sai. */
export async function deleteMyAccount(input: unknown): Promise<Result> {
  const p = z.object({ confirm: z.string() }).safeParse(input);
  if (!p.success || !confirmsDeletion(p.data.confirm)) return { ok: false, message: "Digite EXCLUIR para confirmar." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para excluir a conta." };
  const { data: owner } = await supabase.rpc("is_owner");
  if (owner === true) return { ok: false, message: "A conta do dono não é excluída pela tela." };
  try {
    await removePersonalFiles(supabase, auth.user.id);
  } catch {
    return { ok: false, message: "Não foi possível apagar suas fotos agora. Nada foi excluído; tente de novo." };
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: explain(error.message) };
  await supabase.auth.signOut();
  redirect("/entrar?conta=excluida");
}
