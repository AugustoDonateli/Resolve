import type { Metadata } from "next";
import Link from "next/link";
import { Correction } from "@/components/essay/correction";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Redação" };

export default function RedacaoPage() {
  return (
    <>
      <ScreenHeader title="Redação" kicker="Correção por competência">
        <Link
          href="/redacao/temas"
          className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 t-ui hover:bg-surface-subtle"
        >
          Temas
        </Link>
      </ScreenHeader>
      <Correction />
    </>
  );
}
