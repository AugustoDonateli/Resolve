import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DuelStrip } from "@/components/groups/duel-strip";
import { PlayDuel } from "@/components/groups/group-actions";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadDuel } from "@/lib/groups/data";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Duelo" };
export const dynamic = "force-dynamic";

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default async function DueloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { board: d, groupName } = await loadDuel(id);
  const me = d.players.find((p) => p.me);
  const title = `${d.area ? AREA_LABEL[d.area] : "Todas as áreas"} · ${d.total} questões`;
  return (
    <>
      <Link href={`/grupos/${d.groupId}`} className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> {groupName}
      </Link>
      <ScreenHeader title="Duelo" kicker={title} />
      <div className="flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="t-reading text-ink-2">
            {d.open ? `Aberto até ${fmtDay(d.closesAt)}.` : "Duelo fechado."}{" "}
            {d.revealed ? "Placar completo." : "Os acertos dos outros aparecem quando você terminar."}
          </p>
          {d.open && !me?.finished && <PlayDuel duelId={d.id} label={me ? "Continuar" : "Começar"} />}
        </div>
        <section aria-labelledby="placar" className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface p-5 sm:p-7">
          <h2 id="placar" className="t-kicker">
            Placar
          </h2>
          {d.players.length === 0 ? (
            <p className="t-meta text-ink-2">Ninguém jogou ainda.</p>
          ) : (
            d.players.map((p) => <DuelStrip key={p.nickname} player={p} total={d.total} revealed={d.revealed} />)
          )}
          <p className="t-meta text-ink-2">Bolinha cheia: acerto · contorno: respondida · tracejado: ainda não.</p>
        </section>
      </div>
    </>
  );
}
