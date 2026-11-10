import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CorrectionResult } from "@/components/essay/correction-result";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadCorrection } from "@/lib/essay/correction";

export const metadata: Metadata = { title: "Correção" };
export const dynamic = "force-dynamic";

export default async function CorrectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadCorrection(id);
  return (
    <>
      <Link href="/redacao/minhas" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Minhas redações
      </Link>
      <ScreenHeader title="Correção" kicker={view.promptTitle ? `Tema: ${view.promptTitle}` : "Tema livre"} />
      <CorrectionResult view={view} />
    </>
  );
}
