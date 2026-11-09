import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalReview } from "@/components/editor/proposal-review";
import { StatusBadge } from "@/components/editor/status-badge";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getProposal } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Revisar proposta" };
export const dynamic = "force-dynamic";

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rev?: string; salvo?: string }> }) {
  const { id } = await params;
  const { rev, salvo } = await searchParams;
  const detail = await getProposal(id);
  const p = detail.proposal;
  const viewing = rev === undefined ? null : Number(rev);
  if (viewing !== null && !detail.revisions.some((r) => r.revision === viewing)) notFound();
  const shown = viewing === null ? null : detail.revisions.find((r) => r.revision === viewing)!;
  const saved = salvo === undefined ? null : (detail.revisions.find((r) => r.revision === Number(salvo)) ?? null);

  return (
    <>
      <Link href="/editor" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Propostas
      </Link>
      <ScreenHeader
        kicker={`${p.payload.source.booklet_file} · área ${p.payload.area}`}
        title={`Questão ${p.question_number}${p.foreign_language ? ` (${LANG[p.foreign_language]})` : ""}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={p.status} />
          <span className="t-meta text-ink-2">Revisão {p.current_revision}</span>
          <Link href={`/editor/proposta/${p.id}/etiquetas`} className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 t-ui hover:bg-surface-subtle">
            Etiquetas e aprovação
          </Link>
        </div>
      </ScreenHeader>
      <ProposalReview
        key={`${p.current_revision}-${viewing ?? "atual"}`}
        detail={detail}
        viewing={shown ? { revision: shown.revision, payload: shown.payload } : null}
        saved={saved}
      />
    </>
  );
}
