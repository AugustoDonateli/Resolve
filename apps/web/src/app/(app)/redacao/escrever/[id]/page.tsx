import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { EssayEditor } from "@/components/essay/essay-editor";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadDraft } from "@/lib/essay/drafts";
import { pieceOf } from "@/lib/essay/pieces";

export const metadata: Metadata = { title: "Escrever redação" };
export const dynamic = "force-dynamic";

export default async function WritePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = await loadDraft(id);
  return (
    <>
      <Link
        href="/redacao/minhas"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Minhas redações
      </Link>
      <ScreenHeader
        title="Escrever"
        kicker={`${pieceOf(draft.trainingPiece) ? `Treino por peça · ${pieceOf(draft.trainingPiece)!.label} · ` : ""}${draft.promptTitle ? `Tema: ${draft.promptTitle}` : "Tema livre"}`}
      />
      <EssayEditor draft={draft} />
    </>
  );
}
