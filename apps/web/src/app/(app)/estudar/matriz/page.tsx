import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadMatrix } from "@/lib/study/matrix";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Matriz e incidência" };
export const dynamic = "force-dynamic";

export default async function MatrizPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area: q } = await searchParams;
  const m = await loadMatrix();
  const area = m?.areas.find((a) => a.code === q) ?? m?.areas[0];
  const max = Math.max(1, ...(area?.competencies.flatMap((c) => c.skills.map((s) => s.published)) ?? [0]));
  return (
    <>
      <Link href="/estudar" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Matriz e incidência" kicker="O que a prova cobra" />
      {!m || !area ? (
        <p className="t-reading text-ink-2">A matriz de referência ainda não foi carregada.</p>
      ) : (
        <div className="flex max-w-4xl flex-col gap-8">
          <p className="t-reading text-ink-2">
            Texto oficial da {m.label} ({m.source.institution}).{" "}
            {m.taggedItems > 0
              ? `A incidência conta ${m.taggedItems} ${m.taggedItems === 1 ? "questão publicada" : "questões publicadas"} no Resolve com habilidade revisada; é a amostra do banco, não a prova inteira.`
              : "Incidência indisponível: nenhuma questão publicada tem etiqueta de habilidade revisada ainda."}
          </p>
          <nav aria-label="Áreas" className="flex flex-wrap gap-2">
            {m.areas.map((a) => (
              <Link
                key={a.code}
                href={`/estudar/matriz?area=${a.code}`}
                aria-current={a.code === area.code ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center rounded-full border px-4 t-ui",
                  a.code === area.code ? "border-ink bg-ink text-background" : "border-line bg-surface text-ink hover:bg-surface-subtle",
                )}
              >
                {AREA_LABEL[a.code]}
              </Link>
            ))}
          </nav>
          {area.competencies.map((c) => (
            <section key={c.code} aria-labelledby={`c-${c.code}`} className="flex flex-col">
              <h2 id={`c-${c.code}`} className="mb-2 flex gap-3 t-ui text-ink">
                <span className="shrink-0 font-display text-[22px] leading-none text-ink-2">{c.code.replace("C", "C ")}</span>
                <span className="font-medium">{c.description}</span>
              </h2>
              <ul className="flex flex-col border-t border-line-subtle">
                {c.skills.map((s) => (
                  <li key={s.code}>
                    <Link
                      href={`/estudar/matriz/${area.code}/${s.code}`}
                      className="group grid min-h-14 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3 hover:bg-surface-subtle/60"
                    >
                      <span className="t-ui font-medium tabular text-ink">{s.code}</span>
                      <span className="t-meta text-ink">{s.description}</span>
                      <span className="flex items-center gap-2">
                        {s.published > 0 ? (
                          <>
                            <span aria-hidden className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round((s.published / max) * 64) + 4}px` }} />
                            <span className="t-meta tabular text-ink-2">{s.published}</span>
                          </>
                        ) : (
                          <span className="t-meta text-ink-2" aria-label="sem questões revisadas">—</span>
                        )}
                        <ChevronRight aria-hidden className="size-4 text-ink-2 transition-transform duration-[var(--rs-dur-state)] group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
