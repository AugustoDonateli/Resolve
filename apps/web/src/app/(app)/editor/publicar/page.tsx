import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ContentPublish } from "@/components/editor/content-publish";
import { PublishQueue } from "@/components/editor/publish-queue";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getContentPublicationQueue, getPublicationQueue } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Publicação" };
export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const [queue, content] = await Promise.all([getPublicationQueue(), getContentPublicationQueue()]);
  return (
    <>
      <Link href="/editor" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Propostas
      </Link>
      <ScreenHeader title="Publicação" kicker="Área do editor" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Só entra no banco de estudo a questão com etiquetas aprovadas na revisão atual do conteúdo, gabarito oficial, cruzamento com outra cor conferido e figuras recortadas com texto alternativo. A publicação é feita em lote, numa única operação: se uma questão falhar, nenhuma é publicada. Publicado não muda; correção vira nova versão.
      </p>
      <div className="mb-10">
        <ContentPublish rows={content} />
      </div>
      <h2 className="mb-3 t-section">Publicação completa (com etiquetas aprovadas)</h2>
      <PublishQueue rows={queue} />
    </>
  );
}
