/**
 * Configuração do Supabase. Sem as variáveis, o app roda em "modo local"
 * (desenvolvimento sem conta): sem login e com preferências só no aparelho.
 * Em produção as duas variáveis são obrigatórias.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Rotas acessíveis sem sessão. */
export const PUBLIC_PATHS = ["/entrar", "/auth/callback"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Aceita apenas destinos internos após o login (evita redirecionamento aberto). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/hoje";
  if (isPublicPath(next)) return "/hoje";
  return next;
}
