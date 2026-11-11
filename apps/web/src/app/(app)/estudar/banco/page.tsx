import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ResolveFiltered } from "@/components/question/resolve-filtered";
import { ScreenHeader } from "@/components/shell/app-shell";
import {
  FILTER_LABEL,
  filterBank,
  options,
  parseFilters,
  recoveries,
  toQuery,
  type BankFilters,
} from "@/lib/study/bank";
import { loadBank } from "@/lib/study/bank-data";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Banco de questões" };
export const dynamic = "force-dynamic";

const selectCls =
  "w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";

/** Banco e filtros (F3-T10). O formulário funciona sem JavaScript (GET); só publicadas aparecem. */
export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseFilters(await searchParams);
  const items = (await loadBank()) ?? [];
  const result = filterBank(items, f);
  const opts = options(items, f);
  const rec =
    result.length === 0 && items.length > 0 ? recoveries(items, f) : [];
  const active = (Object.keys(f) as (keyof BankFilters)[]).filter((k) => f[k]);
  return (
    <>
      <Link
        href="/estudar"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Banco de questões" kicker="Estudar" />
      {items.length === 0 ? (
        <p className="max-w-xl rounded-card border border-line-subtle bg-surface p-6 t-reading">
          Ainda não há questões publicadas. O banco mostra só questões reais do
          Enem conferidas.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <form
            method="get"
            aria-label="Filtros"
            className="grid gap-4 rounded-panel border border-line bg-surface p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3"
          >
            <label className="flex min-w-0 flex-col gap-1.5 t-ui">
              Área
              <select
                name="area"
                defaultValue={f.area ?? ""}
                className={selectCls}
              >
                <option value="">Todas</option>
                {(Object.keys(AREA_LABEL) as (keyof typeof AREA_LABEL)[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {AREA_LABEL[k]} ({opts.areas.get(k) ?? 0})
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 t-ui">
              Habilidade
              <select
                name="habilidade"
                defaultValue={f.skill ?? ""}
                className={selectCls}
              >
                <option value="">Todas</option>
                {opts.skills.map(([code, n]) => (
                  <option key={code} value={code}>
                    {code} ({n})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 t-ui">
              Assunto
              <select
                name="assunto"
                defaultValue={f.subject ?? ""}
                className={selectCls}
              >
                <option value="">Todos</option>
                {opts.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.n})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 t-ui">
              Edição
              <select
                name="edicao"
                defaultValue={f.year ?? ""}
                className={selectCls}
              >
                <option value="">Todas</option>
                {opts.years.map(([year, n]) => (
                  <option key={year} value={year}>
                    Enem {year} ({n})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 t-ui">
              Dia de prova
              <select
                name="dia"
                defaultValue={f.day ?? ""}
                className={selectCls}
              >
                <option value="">Os dois dias</option>
                <option value="d1">
                  1º dia ({opts.days.get("d1") ?? 0})
                </option>
                <option value="d2">
                  2º dia ({opts.days.get("d2") ?? 0})
                </option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
              >
                Filtrar
              </button>
              {active.length > 0 && (
                <Link
                  href="/estudar/banco"
                  className="inline-flex min-h-11 items-center px-2 t-ui underline"
                >
                  Limpar filtros
                </Link>
              )}
            </div>
          </form>

          <section aria-labelledby="resultado" className="flex flex-col gap-3">
            <h2 id="resultado" className="t-section" aria-live="polite">
              {result.length} {result.length === 1 ? "questão" : "questões"}
            </h2>
            {result.length === 0 ? (
              <div className="max-w-xl rounded-card border border-line-subtle bg-surface p-4">
                <p className="t-reading">
                  Nenhuma questão publicada com essa combinação.
                </p>
                {rec.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {rec.map((r) => (
                      <li key={r.drop}>
                        <Link
                          href={`/estudar/banco${toQuery({ ...f, [r.drop]: undefined })}`}
                          className="inline-flex min-h-11 items-center t-ui underline"
                        >
                          Tirar o filtro de {FILTER_LABEL[r.drop]} ({r.count}{" "}
                          {r.count === 1 ? "questão" : "questões"})
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/estudar/banco"
                  className="mt-2 inline-flex min-h-11 items-center t-ui underline"
                >
                  Limpar todos os filtros
                </Link>
              </div>
            ) : (
              <>
                <ResolveFiltered ids={result.map((i) => i.itemVersionId)} />
                <ul className="flex flex-col gap-2">
                  {result.slice(0, 100).map((i) => (
                    <li
                      key={i.itemVersionId}
                      className="rounded-card border border-line-subtle bg-surface p-3"
                    >
                      <p className="t-meta text-ink-2">
                        {AREA_LABEL[i.area]}
                        {i.origins[0]
                          ? ` · Enem${i.origins[0].year ? ` ${i.origins[0].year}` : ""}, ${i.origins[0].day}º dia, caderno ${i.origins[0].booklet}, questão ${i.origins[0].position}`
                          : ""}
                        {i.skills.length ? ` · ${i.skills.join(", ")}` : ""}
                        {i.subjects.length
                          ? ` · ${i.subjects.map((s) => s.name).join(", ")}`
                          : ""}
                      </p>
                      <p className="t-reading">{i.preview}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
