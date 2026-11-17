import { NextResponse } from "next/server";
import { listPersonalFiles } from "@/lib/club/storage";
import { TERMS_VERSION } from "@/lib/club/terms";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Tabelas com os dados da própria conta (as políticas do banco só devolvem as linhas dela). */
const TABLES = [
  "profiles", "user_preferences", "members", "study_sessions", "attempts", "attempt_events", "attempt_evidence", "attempt_distractor_choices",
  "triage_decisions", "error_entries", "review_items", "review_events", "card_review_items", "card_reviews", "essay_track_progress",
  "repertoire_items", "availability_rules", "fixed_commitments", "schedule_exceptions", "goals", "if_then_plans", "course_goals",
  "study_plan_days", "study_blocks", "focus_intervals", "rest_days", "study_group_members", "duel_entries", "item_reports",
] as const;

/**
 * Exportar meus dados: um arquivo JSON com tudo o que é da conta, as redações com todas as versões e a lista das
 * fotos com links de download válidos por 7 dias. Tabela que não pôde ser lida aparece em "indisponivel".
 */
export async function GET() {
  if (!authEnabled) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse(null, { status: 401 });
  const out: Record<string, unknown> = {};
  const unavailable: Record<string, string> = {};
  await Promise.all(
    TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t).select("*").limit(50000);
      if (error) unavailable[t] = error.message;
      else out[t] = data;
    }),
  );
  const essays = await supabase.from("essays").select("*, essay_versions(*)").limit(5000);
  if (essays.error) unavailable.essays = essays.error.message;
  else out.essays = essays.data;
  let files: { path: string; url: string | null }[] = [];
  try {
    const paths = await listPersonalFiles(supabase, auth.user.id);
    const { data: signed } = paths.length ? await supabase.storage.from("pessoal").createSignedUrls(paths, 7 * 86400) : { data: [] };
    files = paths.map((path, i) => ({ path, url: signed?.[i]?.signedUrl ?? null }));
  } catch (e) {
    unavailable.arquivos = e instanceof Error ? e.message : "erro";
  }
  const body = {
    formato: "resolve-exportacao/v1",
    gerado_em: new Date().toISOString(),
    conta: { id: auth.user.id, email: auth.user.email, criada_em: auth.user.created_at },
    termos_vigentes: TERMS_VERSION,
    arquivos: files,
    dados: out,
    indisponivel: unavailable,
  };
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="resolve-meus-dados-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
