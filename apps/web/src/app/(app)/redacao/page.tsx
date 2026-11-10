import type { Metadata } from "next";
import Link from "next/link";
import { Correction } from "@/components/essay/correction";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Redação" };

export default function RedacaoPage() {
  return (
    <>
      <ScreenHeader title="Redação" kicker="Correção por competência">
        <nav aria-label="Redação" className="flex flex-wrap items-center gap-2">
          <Link
            href="/redacao/temas"
            className="inline-flex min-h-11 items-center rounded-control px-3 t-ui text-ink hover:bg-surface-subtle"
          >
            Temas
          </Link>
          <Link
            href="/redacao/pecas"
            className="inline-flex min-h-11 items-center rounded-control px-3 t-ui text-ink hover:bg-surface-subtle"
          >
            Treino por peças
          </Link>
          <Link
            href="/redacao/minhas"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
          >
            Minhas redações
          </Link>
        </nav>
      </ScreenHeader>
      <Correction />
    </>
  );
}
