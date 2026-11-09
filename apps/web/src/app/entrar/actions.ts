"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth/errors";
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

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) return { mode, email, error: authErrorMessage(error) };
  if (data.session) redirect("/hoje");
  return { mode: "entrar", email, info: "Conta criada. Enviamos um link de confirmação para o seu e-mail; abra-o e depois entre." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
