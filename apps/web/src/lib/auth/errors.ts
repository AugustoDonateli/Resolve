/** Mensagens de autenticação: o que ocorreu e o que fazer (plano §6, escrita). */
export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!err) return "";
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "E-mail ou senha não conferem. Confira e tente de novo.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "Seu e-mail ainda não foi confirmado. Abra o link que enviamos e depois entre.";
  if (msg.includes("database error saving new user") || msg.includes("resolve_signup_closed"))
    return "O cadastro está fechado e este e-mail não tem convite.";
  if (code === "user_already_exists" || msg.includes("already registered"))
    return "Já existe uma conta com este e-mail. Use Entrar.";
  if (code === "weak_password" || msg.includes("password should be"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429)
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível concluir agora. Seus dados continuam no formulário; tente de novo.";
}
