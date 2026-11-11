import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ReportQueue, type ReportRow } from "@/components/editor/report-queue";
import { ScreenHeader } from "@/components/shell/app-shell";
import { requireEditor } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Ocorrências" };
export const dynamic = "force-dynamic";

/** Ocorrências relatadas por alunos (F3-T17), ligadas à versão exata. Corrigir segue o fluxo editorial. */
export default async function ReportsPage() {
  const { supabase } = await requireEditor();
  const { data } = await supabase
    .from("item_reports")
    .select(
      "id, item_version_id, kind, message, status, editor_note, created_at, handled_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const versionIds = [...new Set((data ?? []).map((r) => r.item_version_id))];
  const { data: places } = versionIds.length
    ? await supabase
        .from("study_items")
        .select("item_version_id, area, appearances")
        .in("item_version_id", versionIds)
    : { data: [] };
  const where = new Map(
    (places ?? []).map((p) => {
      const a = (
        p.appearances as
          | { year?: number; day: number; booklet: number; position: number }[]
          | null
      )?.[0];
      return [
        p.item_version_id,
        a
          ? `${p.area} · Enem${a.year ? ` ${a.year}` : ""}, ${a.day}º dia, caderno ${a.booklet}, questão ${a.position}`
          : p.area,
      ];
    }),
  );
  const rows: ReportRow[] = (data ?? []).map((r) => ({
    ...r,
    where: where.get(r.item_version_id) ?? "versão sem publicação",
  }));
  return (
    <>
      <Link
        href="/editor"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Revisão editorial
      </Link>
      <ScreenHeader title="Ocorrências" kicker="Área do editor" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Relatos de alunos sobre versões publicadas. Fechar uma ocorrência não
        muda a questão: a correção passa por nova revisão e publicação.
      </p>
      <ReportQueue rows={rows} />
    </>
  );
}
