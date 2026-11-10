import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { RhythmRunner } from "@/components/question/rhythm-runner";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadSession } from "@/lib/study/session";

export const metadata: Metadata = { title: "Bloco de ritmo" };
export const dynamic = "force-dynamic";

export default async function RhythmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadSession(id);
  return (
    <>
      <Link
        href="/estudar"
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Bloco de ritmo" kicker="Treino de habilidade" />
      <RhythmRunner session={session} />
    </>
  );
}
