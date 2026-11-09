import type { Metadata } from "next";
import { clsx } from "clsx";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/editor/status-badge";
import { listBatches, type ProposalStatus } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Revisão editorial" };
export const dynamic = "force-dynamic";

const FILTERS: { value: ProposalStatus | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "duvida", label: "Com dúvida" },
  { value: "valida", label: "Válidas" },
  { value: "rejeitada", label: "Rejeitadas" },
];

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado = "todas" } = await searchParams;
  const filter = FILTERS.some((f) => f.value === estado) ? estado : "todas";
  const batches = await listBatches();

  return (
    <>
      <ScreenHeader title="Revisão editorial" kicker="Área do editor" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Propostas extraídas dos PDFs oficiais. Nada aqui está publicado: cada correção vira uma revisão nova e a anterior fica no histórico.
      </p>
      <nav aria-label="Filtrar por estado" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <li key={f.value}>
              <Link
                href={f.value === "todas" ? "/editor" : `/editor?estado=${f.value}`}
                aria-current={filter === f.value ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center rounded-control border px-4 t-ui",
                  filter === f.value ? "border-ink bg-surface text-ink" : "border-line-subtle text-ink-2 hover:border-line hover:text-ink",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-8">
        {batches.map((b) => {
          const rows = b.proposals.filter((p) => filter === "todas" || p.status === filter);
          const counts = { valida: 0, duvida: 0, rejeitada: 0, promovida: 0 } as Record<ProposalStatus, number>;
          for (const p of b.proposals) counts[p.status] += 1;
          return (
            <section key={b.id} aria-labelledby={`lote-${b.id}`} className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-6">
              <h2 id={`lote-${b.id}`} className="t-section">
                {b.notes ?? "Lote sem descrição"}
              </h2>
              <p className="mb-4 mt-1 t-meta text-ink-2">
                {b.proposals.length} propostas · {counts.valida} válidas · {counts.duvida} com dúvida · {counts.rejeitada} rejeitadas
              </p>
              {rows.length === 0 ? (
                <p className="t-meta text-ink-2">Nenhuma proposta neste filtro.</p>
              ) : (
                <div className="overflow-x-auto rounded-control" tabIndex={0} role="region" aria-label={`Propostas: ${b.notes ?? "lote"}`}>
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <caption className="sr-only">Propostas do lote</caption>
                    <thead>
                      <tr className="border-b border-line-subtle t-meta text-ink-2">
                        <th scope="col" className="py-2 pr-4 font-normal">Questão</th>
                        <th scope="col" className="py-2 pr-4 font-normal">Estado</th>
                        <th scope="col" className="py-2 pr-4 font-normal">Dúvidas abertas</th>
                        <th scope="col" className="py-2 pr-4 font-normal">Revisão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id} className="border-b border-line-subtle last:border-0">
                          <th scope="row" className="py-1 pr-4 font-normal">
                            <Link href={`/editor/proposta/${p.id}`} className="inline-flex min-h-11 items-center t-ui text-link underline underline-offset-4">
                              Questão {p.question_number}
                              {p.foreign_language ? ` (${LANG[p.foreign_language]})` : ""}
                            </Link>
                          </th>
                          <td className="py-1 pr-4">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-1 pr-4 t-ui tabular-nums">{b.openDoubts[p.id] ?? 0}</td>
                          <td className="py-1 pr-4 t-ui tabular-nums">{p.current_revision}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
