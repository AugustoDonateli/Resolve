"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage, createAccountMessage } from "@/lib/auth/errors";
import { safeNext } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  mode: "entrar" | "criar";
  email: string;
  error?: string;
  info?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

export async function authenticate(prev: AuthState, form: FormData): Promise<AuthState> {
  const mode = form.get("mode") === "criar" ? "criar" : "entrar";
  const rawEmail = String(form.get("email") ?? "");
  const parsed = credentials.safeParse({ email: rawEmail, password: form.get("password") });
  if (!parsed.success) return { mode, email: rawEmail, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { email, password } = parsed.data;

  if (mode === "entrar") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { mode, email, error: authErrorMessage(error) };
    redirect(safeNext(String(form.get("next") ?? "")));
  }

  // Conta criada já ativa, sem e-mail de confirmação (public.create_account).
  const { data: status, error: rpcError } = await supabase.rpc("create_account", { p_email: email, p_password: password });
  if (rpcError) return { mode, email, error: authErrorMessage({ message: rpcError.message }) };
  if (status !== "ok") return { mode, email, error: createAccountMessage(String(status)) };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { mode: "entrar", email, info: "Conta criada. Entre com o e-mail e a senha que você acabou de escolher." };
  redirect("/hoje");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
