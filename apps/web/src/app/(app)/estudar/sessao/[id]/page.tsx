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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadSession(id);
  const duel = session.duelId ? `/grupos/duelo/${session.duelId}` : null;
  return (
    <>
      <Link
        href={duel ?? "/estudar"}
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> {duel ? "Duelo" : "Estudar"}
      </Link>
      <ScreenHeader
        title={duel ? "Duelo" : session.mode === "revisao" ? "Revisão" : "Treino livre"}
        kicker={duel ? "Grupos" : session.mode === "revisao" ? "Revisar" : "Estudar"}
      />
      <SessionRunner session={session} />
    </>
  );
}
