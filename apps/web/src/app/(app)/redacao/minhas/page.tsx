import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { NewEssayButton } from "@/components/essay/new-essay-button";
import { ScreenHeader } from "@/components/shell/app-shell";
import { listMyEssays } from "@/lib/essay/drafts";
import { pieceOf } from "@/lib/essay/pieces";

export const metadata: Metadata = { title: "Minhas redações" };
export const dynamic = "force-dynamic";

export default async function MyEssaysPage() {
  const essays = (await listMyEssays()) ?? [];
  return (
    <>
      <Link
        href="/redacao"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Minhas redações" kicker="Redação" />
      <div className="flex flex-col gap-6">
        <NewEssayButton />
        {essays.length === 0 ? (
          <p className="t-ui">Nenhuma redação ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {essays.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/redacao/escrever/${e.id}`}
                  className="flex flex-col gap-1 rounded-card border border-line-subtle bg-surface p-4 hover:border-line"
                >
                  <span className="t-meta text-ink-2">
                    {e.status === "submetida" ? "Enviada" : "Rascunho"} ·
                    {pieceOf(e.trainingPiece)
                      ? ` Peça: ${pieceOf(e.trainingPiece)!.label} ·`
                      : ""}{" "}
                    {e.promptTitle ?? "Tema livre"} · atualizada em{" "}
                    {new Date(e.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="t-reading">
                    {e.preview || "(em branco)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
