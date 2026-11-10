import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { TrackView } from "@/components/essay/track-view";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadTrack } from "@/lib/essay/track-data";

export const metadata: Metadata = { title: "Redação do zero" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadTrack();
  return (
    <>
      <Link href="/redacao" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Redação do zero" kicker="Trilha" />
      <p className="mb-8 max-w-2xl t-reading text-ink-2">
        Oito etapas, da leitura da proposta à redação completa. Cada uma explica o que a competência pede e leva a um exercício que já existe
        no Resolve. A ordem é uma sugestão: dá para abrir qualquer etapa.
      </p>
      {data ? <TrackView data={data} /> : <p className="t-reading">Entre para guardar o progresso.</p>}
    </>
  );
}
