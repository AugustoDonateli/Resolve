import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isPublicPath, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Renova a sessão do Supabase a cada navegação e protege as telas (F2-T01).
 * A autorização dos dados não depende disto: RLS no banco e verificação em
 * cada Server Action continuam obrigatórias.
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/entrar" && pathname !== "/") url.searchParams.set("next", pathname + search);
    const r = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!user && !isPublicPath(pathname)) return redirectTo("/entrar");
  if (user && pathname === "/entrar") return redirectTo("/hoje");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
