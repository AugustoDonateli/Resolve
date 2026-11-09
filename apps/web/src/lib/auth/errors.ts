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
    return "Este e-mail não está liberado para criar conta no Resolve.";
  if (code === "user_already_exists" || msg.includes("already registered"))
    return "Já existe uma conta com este e-mail. Use Entrar.";
  if (code === "weak_password" || msg.includes("password should be"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429)
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível concluir agora. Seus dados continuam no formulário; tente de novo.";
}

/** Resultado de public.create_account. */
export function createAccountMessage(status: string): string {
  switch (status) {
    case "not_allowed":
      return "Este e-mail não está liberado para criar conta no Resolve.";
    case "exists":
      return "Já existe uma conta com este e-mail. Use Entrar.";
    case "weak_password":
      return "A senha precisa ter entre 8 e 72 caracteres.";
    case "invalid_email":
      return "Digite um e-mail válido.";
    case "rate_limited":
      return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
    default:
      return "Não foi possível criar a conta agora. Seus dados continuam no formulário; tente de novo.";
  }
}
