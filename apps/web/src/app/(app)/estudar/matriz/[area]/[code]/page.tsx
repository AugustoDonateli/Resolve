import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { TrainSkill } from "@/components/matrix/train-skill";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadSkillSheet } from "@/lib/study/matrix";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Ficha da habilidade" };
export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ area: string; code: string }> }) {
  const { area, code } = await params;
  const f = await loadSkillSheet(area, code);
  return (
    <>
      <Link href={`/estudar/matriz?area=${f.area}`} className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> Matriz · {AREA_LABEL[f.area]}
      </Link>
      <ScreenHeader title={`Habilidade ${f.skill.code.replace("H", "")}`} kicker={`${AREA_LABEL[f.area]} · ${f.competency.code}`} />
      <div className="grid max-w-5xl gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-8">
          <figure className="border-l-4 border-ink pl-5">
            <blockquote className="font-display text-[26px] leading-snug text-ink">{f.skill.description}</blockquote>
            <figcaption className="mt-3 t-meta text-ink-2">
              {f.matrixLabel}
              {f.skill.page ? `, p. ${f.skill.page}` : ""} ·{" "}
              <a href={f.source.url} className="underline" target="_blank" rel="noreferrer">
                {f.source.institution}
              </a>
            </figcaption>
          </figure>
          <section aria-labelledby="competencia" className="flex flex-col gap-1">
            <h2 id="competencia" className="t-kicker">
              Competência {f.competency.code.replace("C", "")}
            </h2>
            <p className="t-reading text-ink">{f.competency.description}</p>
          </section>
          <TrainSkill skillId={f.skill.id} available={f.questions.length} />
        </div>
        <aside className="flex flex-col gap-8">
          <section aria-labelledby="incidencia" className="flex flex-col gap-2">
            <h2 id="incidencia" className="t-kicker">
              No banco do Resolve
            </h2>
            {f.questions.length ? (
              <>
                <p className="t-reading text-ink">
                  {f.questions.length} {f.questions.length === 1 ? "questão publicada" : "questões publicadas"} com esta habilidade revisada.
                </p>
                <ul className="flex flex-col">
                  {f.questions.map((q) => (
                    <li key={q.itemVersionId} className="border-b border-line-subtle py-2 t-meta text-ink-2">
                      {q.origin}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="t-meta text-ink-2">Indisponível: nenhuma questão publicada tem esta habilidade em etiqueta revisada.</p>
            )}
          </section>
          <section aria-labelledby="cartoes" className="flex flex-col gap-2">
            <h2 id="cartoes" className="t-kicker">
              Cartões de conceito
            </h2>
            {f.cards.length ? (
              <ul className="flex flex-col gap-3">
                {f.cards.map((c) => (
                  <li key={c.id} className="rounded-card border border-line-subtle bg-surface p-4">
                    <p className="t-ui font-medium text-ink">{c.front}</p>
                    <p className="mt-1 whitespace-pre-line t-meta text-ink">{c.back}</p>
                    <p className="mt-2 t-meta text-ink-2">Fonte: {c.source}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-meta text-ink-2">Nenhum cartão publicado para esta habilidade ainda.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
