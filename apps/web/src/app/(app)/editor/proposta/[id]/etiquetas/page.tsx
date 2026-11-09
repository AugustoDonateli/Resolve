import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/editor/status-badge";
import { TagReview } from "@/components/editor/tag-review";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getTagReviewContext } from "@/lib/editor/data";
import type { Tags } from "@/lib/editor/tags";

export const metadata: Metadata = { title: "Etiquetas e aprovação" };
export const dynamic = "force-dynamic";

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;
const SUBJECTS_ABSENT = "Taxonomia de assuntos ainda não carregada no Resolve.";

function emptyTags(): Tags {
  return {
    skill: null,
    secondary_skill: null,
    content_dependency: null,
    subjects: { ids: [], absent_reason: SUBJECTS_ABSENT },
    evidence: [],
    evidence_absent_reason: "",
    distractors: [],
    explanation: { steps: [], absent_reason: "" },
  };
}

/** Converte a sugestão do modelo (tag-suggestion/v1) para o formulário; o editor confere tudo. */
function fromSuggestion(s: Record<string, unknown>): Tags {
  const t = emptyTags();
  const skill = s.skill as { code?: string } | null;
  const dep = s.content_dependency as { level?: number } | null;
  const ev = (s.evidence as { block_id: string; quote: string; rationale: string; start_utf16: number | null; end_utf16: number | null }[]) ?? [];
  const ds = (s.distractors as { letter: string; type: string; secondary_type: string | null; rationale: string }[]) ?? [];
  t.skill = skill?.code ? { code: skill.code } : null;
  t.content_dependency = typeof dep?.level === "number" ? dep.level : null;
  t.evidence = ev
    .filter((e) => e.start_utf16 !== null && e.end_utf16 !== null)
    .map((e) => ({ type: "text" as const, block_id: e.block_id, start_utf16: e.start_utf16!, end_utf16: e.end_utf16!, quote: e.quote, rationale: e.rationale }));
  t.distractors = ds.map((d) => ({ letter: d.letter as Tags["distractors"][number]["letter"], type: d.type, secondary_type: d.secondary_type, rationale: d.rationale }));
  return t;
}

export default async function TagReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTagReviewContext(id);
  const p = ctx.proposal;
  const last = ctx.reviews[0];
  const initial: { tags: Tags; origin: string } = last
    ? { tags: { ...emptyTags(), ...(last.tags as Partial<Tags>) }, origin: `última revisão de etiquetas (${last.decision}, revisão ${last.proposal_revision} do conteúdo)` }
    : ctx.suggestion
      ? { tags: fromSuggestion(ctx.suggestion.suggestion), origin: `sugestão do modelo ${ctx.suggestion.model_served ?? ""} (${ctx.suggestion.prompt_version}), ${ctx.suggestion.status}` }
      : { tags: emptyTags(), origin: "preenchimento manual (sem sugestão do modelo)" };

  return (
    <>
      <Link href={`/editor/proposta/${p.id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Conteúdo da questão
      </Link>
      <ScreenHeader
        kicker={`Etiquetas e aprovação · ${p.payload.source.booklet_file}`}
        title={`Questão ${p.question_number}${p.foreign_language ? ` (${LANG[p.foreign_language]})` : ""}`}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={p.status} />
          <span className="t-meta text-ink-2">Conteúdo na revisão {p.current_revision}</span>
        </div>
      </ScreenHeader>
      <TagReview key={`${p.current_revision}-${ctx.reviews.length}`} ctx={ctx} initial={initial} />
    </>
  );
}
