import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { QuestionPreview } from "@/components/question/question-preview";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getProposal } from "@/lib/editor/data";
import { fromProposal, missingAlt } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Prévia do aluno" };
export const dynamic = "force-dynamic";

/** Prévia do aluno (F1-T05): a questão real como aparecerá no estudo, antes de publicar. Só editores. */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { proposal, figureUrls } = await getProposal(id);
  const question = fromProposal(proposal.payload, figureUrls);
  const missing = missingAlt(question);
  return (
    <>
      <Link
        href={`/editor/proposta/${id}`}
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Voltar à revisão
      </Link>
      <ScreenHeader title="Prévia do aluno" kicker="Área do editor" />
      <p className="mb-2 max-w-2xl t-meta text-ink-2">
        Como a questão aparecerá no estudo. A proposta ainda não foi publicada:
        o aluno não a vê, e o gabarito não aparece aqui.
      </p>
      {missing > 0 && (
        <p
          role="note"
          className="mb-4 max-w-2xl rounded-card border border-ink p-3 t-ui"
        >
          {missing === 1
            ? "1 figura ainda está"
            : `${missing} figuras ainda estão`}{" "}
          sem texto alternativo. Escreva na revisão antes de publicar.
        </p>
      )}
      <QuestionPreview question={question} />
    </>
  );
}
