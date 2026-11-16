import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { SessionRunner } from "@/components/question/session-runner";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadSession } from "@/lib/study/session";

export const metadata: Metadata = { title: "Treino" };
export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ primeira?: string }>;
}) {
  const [{ id }, { primeira }] = await Promise.all([params, searchParams]);
  const session = await loadSession(id);
  const duel = session.duelId ? `/grupos/duelo/${session.duelId}` : null;
  // Primeira questão do tutorial: sessão de uma questão aberta a partir dos primeiros passos, em Hoje.
  const firstTime = primeira === "1" && !duel && session.entries.length === 1;
  return (
    <>
      <Link
        href={firstTime ? "/hoje" : (duel ?? "/estudar")}
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> {firstTime ? "Hoje" : duel ? "Duelo" : "Estudar"}
      </Link>
      <ScreenHeader
        title={firstTime ? "Primeira questão" : duel ? "Duelo" : session.mode === "revisao" ? "Revisão" : "Treino livre"}
        kicker={firstTime ? "Primeiros passos" : duel ? "Grupos" : session.mode === "revisao" ? "Revisar" : "Estudar"}
      />
      <SessionRunner session={session} firstTime={firstTime} />
    </>
  );
}
