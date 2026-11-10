import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { QuestionRaioX } from "@/components/question/question-raiox";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Questão demonstrativa" };

/** Protótipo F1-T18 com questão demonstrativa identificada (não é item do ENEM). */
export default function DemonstracaoPage() {
  return (
    <>
      <Link
        href="/estudar"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Resolver questão" kicker="Estudar · demonstração" />
      <QuestionRaioX />
    </>
  );
}
