import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PiecePicker } from "@/components/essay/piece-picker";
import { ScreenHeader } from "@/components/shell/app-shell";
import { listPublishedPrompts } from "@/lib/essay/prompts";

export const metadata: Metadata = { title: "Treino por peças" };
export const dynamic = "force-dynamic";

export default async function PiecesPage() {
  const prompts = await listPublishedPrompts();
  return (
    <>
      <Link
        href="/redacao"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Treino por peças" kicker="Redação" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Escreva uma parte da redação por vez. A peça fica salva como texto
        próprio e não recebe nota total.
      </p>
      <PiecePicker
        prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
      />
    </>
  );
}
