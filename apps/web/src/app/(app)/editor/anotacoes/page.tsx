import type { Metadata } from "next";
import { clsx } from "clsx";
import Link from "next/link";
import { AnnotationReviewer } from "@/components/editor/annotation-review";
import { ScreenHeader } from "@/components/shell/app-shell";
import { AREAS, pendingByArea, type AreaCode } from "@/lib/editor/annotation-types";
import { loadAnnotation, loadAnnotationQueue, loadReviewOptions } from "@/lib/editor/annotations";
import { requireEditor } from "@/lib/editor/data";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Conferência das anotações" };
export const dynamic = "force-dynamic";

export default async function AnnotationReviewPage({ searchParams }: { searchParams: Promise<{ area?: string; q?: string }> }) {
  const { area: areaParam, q } = await searchParams;
  const { supabase } = await requireEditor();
  const queue = await loadAnnotationQueue(supabase);
  const counts = pendingByArea(queue);
  const asked = queue.find((r) => r.id === q);
  const area: AreaCode =
    asked?.area ??
    (AREAS.includes(areaParam as AreaCode) ? (areaParam as AreaCode) : (AREAS.find((a) => counts[a].pending > 0) ?? AREAS[0]));
  const rows = queue.filter((r) => r.area === area);
  const start = asked ? rows.findIndex((r) => r.id === asked.id) : Math.max(0, rows.findIndex((r) => r.status === "proposta"));
  const [initial, options] = await Promise.all([
    rows[start] ? loadAnnotation(supabase, rows[start].id) : Promise.resolve(null),
    loadReviewOptions(supabase, area),
  ]);
  const left = AREAS.reduce((n, a) => n + counts[a].pending, 0);

  return (
    <>
      <ScreenHeader title="Conferência" kicker="Área do editor · anotações das questões">
        <Link href="/editor" className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 t-ui hover:bg-surface-subtle">
          Revisão editorial
        </Link>
      </ScreenHeader>
      <p className="mb-5 max-w-[68ch] t-meta text-ink-2">
        Cada questão publicada tem uma anotação proposta: habilidade, assunto, evidência, por que cada errada atrai e a resolução. Nada disso
        chega ao aluno antes da sua conferência. {left > 0 ? `Faltam ${left} de ${queue.length}.` : queue.length > 0 ? "Todas conferidas." : ""}
      </p>
      <nav aria-label="Área" className="mb-7">
        <ul className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <li key={a}>
              <Link
                href={`/editor/anotacoes?area=${a}`}
                aria-current={a === area ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center gap-2 rounded-control border px-4 t-ui",
                  a === area ? "border-ink bg-surface text-ink" : "border-line-subtle text-ink-2 hover:border-line hover:text-ink",
                )}
              >
                {AREA_LABEL[a]}
                <span className="t-meta tabular text-ink-2">
                  {counts[a].pending > 0 ? counts[a].pending : "feita"}
                  <span className="sr-only">{counts[a].pending > 0 ? " por conferir" : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {initial ? (
        <AnnotationReviewer key={area} area={area} rows={rows} startIndex={start} initial={initial} options={options} />
      ) : (
        <p className="t-reading text-ink-2">Nenhuma anotação proposta nesta área.</p>
      )}
    </>
  );
}
