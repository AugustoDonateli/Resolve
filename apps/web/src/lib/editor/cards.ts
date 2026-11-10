import "server-only";
import { requireEditor } from "./data";

export interface CardRow {
  id: string;
  area_code: "LC" | "MT" | "CN" | "CH" | "RED";
  kind: "conceito" | "formula";
  front: string;
  back: string;
  source_locator: string;
  status: "rascunho" | "publicado" | "aposentado";
  published_at: string | null;
  skill: { code: string } | null;
  source: { title: string } | null;
}

export interface SourceOption {
  id: string;
  title: string;
  kind: string;
}

export async function listCards(): Promise<{ cards: CardRow[]; sources: SourceOption[] }> {
  const { supabase } = await requireEditor();
  const [{ data: cards }, { data: sources }] = await Promise.all([
    supabase
      .from("concept_cards")
      .select("id, area_code, kind, front, back, source_locator, status, published_at, skill:skills(code), source:sources(title)")
      .order("created_at", { ascending: false }),
    supabase.from("sources").select("id, title, kind").in("kind", ["matriz", "cartilha", "prova", "outro"]).order("title"),
  ]);
  return { cards: (cards ?? []) as unknown as CardRow[], sources: (sources ?? []) as SourceOption[] };
}
