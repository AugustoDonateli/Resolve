import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Sumario } from "@/components/ui/sumario";
import { LESSONS } from "@/lib/lessons";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Lições" };

export default function LicoesPage() {
  return (
    <>
      <Link href="/estudar" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Lições" kicker="Aprender antes de praticar" />
      <div className="flex max-w-[72ch] flex-col gap-6">
        <p className="t-reading text-ink-2">
          Cada lição explica um assunto em uns 12 minutos, com exemplo antes da regra, e usa questões reais do Enem: uma resolvida, uma para você
          completar e algumas para fazer sozinho. Estas três são as primeiras, em teste: marque em cada parte se entendeu, se ficou confuso ou se ficou
          chato.
        </p>
        <Sumario
          id="licoes-lista"
          label="Lições em teste"
          items={LESSONS.map((l) => ({ href: `/estudar/licoes/${l.slug}`, title: l.title, tag: `${AREA_LABEL[l.area]} · ${l.minutes} min`, body: l.oneLine }))}
        />
      </div>
    </>
  );
}
