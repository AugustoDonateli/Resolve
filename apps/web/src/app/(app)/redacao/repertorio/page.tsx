import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { RepertoireView } from "@/components/essay/repertoire-view";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadRepertoire } from "@/lib/essay/repertoire";

export const metadata: Metadata = { title: "Repertório" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadRepertoire();
  return (
    <>
      <Link href="/redacao" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Repertório" kicker="Seu banco pessoal" />
      <p className="mb-8 max-w-2xl t-reading text-ink-2">
        Dados, leis, obras e citações que você sabe usar, cada um com a fonte e com uma nota de como ele ajuda a argumentar. Organize por
        eixo para achar rápido na hora de escrever.
      </p>
      {data ? <RepertoireView items={data.items} axes={data.axes} /> : <p className="t-reading">Entre para montar seu repertório.</p>}
    </>
  );
}
