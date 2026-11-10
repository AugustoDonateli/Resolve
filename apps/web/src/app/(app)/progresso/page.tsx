import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyReport } from "@/components/progress/weekly-report";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { loadWeeklyReport } from "@/lib/routine/weekly";

export const metadata: Metadata = { title: "Progresso" };
export const dynamic = "force-dynamic";

export default async function ProgressoPage() {
  const report = await loadWeeklyReport();
  if (!report)
    return (
      <>
        <ScreenHeader title="Progresso" />
        <EmptyState icon={BarChart3} title="Entre para ver seu progresso" body="O relatório usa o que você registra no Resolve." action={{ href: "/entrar", label: "Entrar" }} />
      </>
    );
  return (
    <>
      <ScreenHeader title="Progresso" kicker="O que você fez, sem estimativas" />
      <div className="flex flex-col gap-14">
        <WeeklyReport r={report} />

        <section aria-labelledby="habilidades" className="grid gap-6 border-t border-line-subtle pt-10 md:grid-cols-2">
          <div>
            <h2 id="habilidades" className="t-section">
              Mapa de habilidades
            </h2>
            <p className="mt-2 t-reading text-ink-2">
              Dados insuficientes. Uma habilidade só é classificada depois de oito tentativas sem ajuda, em cinco questões diferentes e em
              dois dias. Até lá, ela aparece como sem evidência, nunca como fraca ou forte.
            </p>
            <Link href="/prototipos/constelacao" className="mt-3 inline-flex min-h-11 items-center t-ui text-link underline">
              Ver como o mapa vai funcionar (demonstração)
            </Link>
          </div>
          <div>
            <h2 id="tri" className="t-section">
              Nota estimada por área (TRI)
            </h2>
            <p className="mt-2 t-reading text-ink-2">
              Indisponível. A estimativa depende dos parâmetros oficiais de cada questão, que ainda não estão no banco, e de conferir o cálculo
              com dados de referência do Inep. Sem isso, qualquer número seria inventado.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
