import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente do Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Um cliente por requisição (`cache`): os vários carregadores de uma mesma página dividem o cliente e,
 * com ele, a conferência de quem está logado. `auth.getUser()` vai ao servidor de autenticação a cada
 * chamada; aqui a resposta é reaproveitada dentro da requisição e descartada se o login mudar
 * (entrar ou sair), para nunca servir uma identidade antiga.
 */
export const createClient = cache(async () => {
  const store = await cookies();
  const client = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Component não pode gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
  const getUser = client.auth.getUser.bind(client.auth);
  let current: ReturnType<typeof getUser> | undefined;
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") current = undefined;
  });
  client.auth.getUser = ((jwt?: string) => (jwt ? getUser(jwt) : (current ??= getUser()))) as typeof client.auth.getUser;
  return client;
});
