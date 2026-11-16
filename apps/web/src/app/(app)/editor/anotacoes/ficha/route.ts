import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadAnnotation } from "@/lib/editor/annotations";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Uma ficha da conferência em JSON. É uma rota (e não uma Server Action) para a próxima ficha ser
 * buscada enquanto a atual é lida, sem entrar na fila das ações de aprovar e devolver.
 * Quem não é editor recebe 404, como no resto da área editorial.
 */
export async function GET(request: NextRequest) {
  const missing = new NextResponse(null, { status: 404 });
  if (!authEnabled) return missing;
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return missing;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return missing;
  const { data: isEditor } = await supabase.rpc("is_editor");
  if (isEditor !== true) return missing;
  const review = await loadAnnotation(supabase, id.data);
  return review ? NextResponse.json(review, { headers: { "Cache-Control": "private, no-store" } }) : missing;
}
