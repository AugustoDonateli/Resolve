import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CardEditor } from "@/components/editor/card-editor";
import { ScreenHeader } from "@/components/shell/app-shell";
import { listCards } from "@/lib/editor/cards";

export const metadata: Metadata = { title: "Cartões revisados" };
export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const { cards, sources } = await listCards();
  return (
    <>
      <Link href="/editor" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Revisão editorial
      </Link>
      <ScreenHeader title="Cartões revisados" kicker="Área do editor" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Conceitos e fórmulas com fonte, separados das questões oficiais e fora da TRI. Um cartão publicado com habilidade entra na revisão de quem erra uma questão dessa habilidade.
      </p>
      <CardEditor cards={cards} sources={sources} />
    </>
  );
}
