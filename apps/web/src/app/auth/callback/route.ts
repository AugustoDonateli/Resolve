import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Retorno do link de confirmação de e-mail (fluxo PKCE). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const dest = url.clone();
  dest.search = "";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      dest.pathname = safeNext(url.searchParams.get("next"));
      return NextResponse.redirect(dest);
    }
  }
  dest.pathname = "/entrar";
  dest.searchParams.set("erro", "link");
  return NextResponse.redirect(dest);
}
