import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface MatrixSkill {
  id: string;
  code: string;
  number: number;
  description: string;
  page: number | null;
  /** Questões publicadas com esta habilidade em etiqueta revisada. */
  published: number;
}

export interface MatrixCompetency {
  code: string;
  number: number;
  description: string;
  skills: MatrixSkill[];
}

export interface MatrixArea {
  code: "LC" | "CH" | "CN" | "MT";
  competencies: MatrixCompetency[];
}

export interface MatrixView {
  label: string;
  source: { title: string; institution: string; url: string; edition: string | null };
  areas: MatrixArea[];
  taggedItems: number;
}

/**
 * Matriz de referência publicada (texto oficial do Inep) com a incidência entre as questões publicadas
 * no Resolve, contada só a partir de etiquetas de habilidade revisadas (a política de linhas já filtra).
 */
export async function loadMatrix(): Promise<MatrixView | null> {
  const supabase = await createClient();
  const { data: mv } = await supabase
    .from("matrix_versions")
    .select("id, label, sources(title, institution, url, edition)")
    .eq("status", "published")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mv) return null;
  const [{ data: areas }, { data: comps }, { data: skills }, { data: tags }] = await Promise.all([
    supabase.from("areas").select("id, code").eq("matrix_version_id", mv.id),
    supabase.from("competencies").select("id, area_id, code, number, description").eq("matrix_version_id", mv.id).order("number"),
    supabase.from("skills").select("id, competency_id, code, number, description, source_page").eq("matrix_version_id", mv.id).order("number"),
    supabase.from("item_skill_tags").select("item_version_id, skill_id").eq("review_status", "aprovada"),
  ]);
  const count = new Map<string, number>();
  for (const t of tags ?? []) count.set(t.skill_id, (count.get(t.skill_id) ?? 0) + 1);
  const order = ["LC", "CH", "CN", "MT"];
  const src = (Array.isArray(mv.sources) ? mv.sources[0] : mv.sources) as MatrixView["source"];
  return {
    label: mv.label,
    source: src,
    taggedItems: new Set((tags ?? []).map((t) => t.item_version_id)).size,
    areas: (areas ?? [])
      .filter((a) => order.includes(a.code))
      .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code))
      .map((a) => ({
        code: a.code as MatrixArea["code"],
        competencies: (comps ?? [])
          .filter((c) => c.area_id === a.id)
          .map((c) => ({
            code: c.code,
            number: c.number,
            description: c.description,
            skills: (skills ?? [])
              .filter((s) => s.competency_id === c.id)
              .map((s) => ({ id: s.id, code: s.code, number: s.number, description: s.description, page: s.source_page, published: count.get(s.id) ?? 0 })),
          })),
      })),
  };
}

export interface SkillSheet {
  area: MatrixArea["code"];
  skill: MatrixSkill;
  competency: { code: string; description: string };
  matrixLabel: string;
  source: MatrixView["source"];
  questions: { itemVersionId: string; origin: string }[];
  cards: { id: string; kind: "conceito" | "formula"; front: string; back: string; source: string }[];
}

/** Ficha de uma habilidade: texto oficial, competência, questões publicadas com etiqueta revisada e cartões publicados. */
export async function loadSkillSheet(area: string, code: string): Promise<SkillSheet> {
  const m = await loadMatrix();
  const a = m?.areas.find((x) => x.code === area);
  const comp = a?.competencies.find((c) => c.skills.some((s) => s.code === code));
  const skill = comp?.skills.find((s) => s.code === code);
  if (!m || !a || !comp || !skill) notFound();
  const supabase = await createClient();
  const [{ data: tags }, { data: cards }] = await Promise.all([
    supabase.from("item_skill_tags").select("item_version_id").eq("skill_id", skill.id).eq("review_status", "aprovada"),
    supabase.from("concept_cards").select("id, kind, front, back, source_locator, sources(title)").eq("skill_id", skill.id).eq("status", "publicado"),
  ]);
  const ids = (tags ?? []).map((t) => t.item_version_id);
  const { data: items } = ids.length
    ? await supabase.from("study_items").select("item_version_id, appearances").in("item_version_id", ids)
    : { data: [] as { item_version_id: string; appearances: { day: number; booklet: number; color: string; position: number }[] | null }[] };
  return {
    area: a.code,
    skill,
    competency: { code: comp.code, description: comp.description },
    matrixLabel: m.label,
    source: m.source,
    questions: (items ?? []).map((i) => {
      const f = i.appearances?.[0];
      return { itemVersionId: i.item_version_id, origin: f ? `Dia ${f.day} · Caderno ${f.booklet} (${f.color}) · Questão ${f.position}` : "Enem" };
    }),
    cards: (cards ?? []).map((c) => ({
      id: c.id,
      kind: c.kind as "conceito" | "formula",
      front: c.front,
      back: c.back,
      source: `${((Array.isArray(c.sources) ? c.sources[0] : c.sources) as { title: string } | null)?.title ?? "Fonte"}, ${c.source_locator}`,
    })),
  };
}
