import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DuelStrip } from "@/components/groups/duel-strip";
import { InviteCode, LeaveGroup, NewDuel } from "@/components/groups/group-actions";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadGroup } from "@/lib/groups/data";
import { AREA_LABEL } from "@/lib/study/question-types";

export const metadata: Metadata = { title: "Grupo" };
export const dynamic = "force-dynamic";

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default async function GrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await loadGroup(id);
  return (
    <>
      <Link href="/grupos" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> Grupos
      </Link>
      <ScreenHeader title={g.name} kicker={`${g.members.length} ${g.members.length === 1 ? "pessoa" : "pessoas"}`} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:gap-14">
        <section aria-labelledby="duelos" className="flex min-w-0 flex-col gap-5">
          <h2 id="duelos" className="t-section">
            Duelos
          </h2>
          <p className="max-w-xl t-meta text-ink-2">
            Todos resolvem as mesmas questões oficiais, cada um no seu tempo, durante 7 dias. Os acertos dos outros aparecem quando
            você termina.
          </p>
          <NewDuel groupId={g.id} />
          {g.duels.length === 0 ? (
            <p className="t-meta text-ink-2">Nenhum duelo ainda.</p>
          ) : (
            <ul className="flex flex-col border-t border-line-subtle">
              {g.duels.map((d) => (
                <li key={d.id}>
                  <Link href={`/grupos/duelo/${d.id}`} className="flex flex-col gap-3 border-b border-line-subtle py-4 hover:bg-surface-subtle/60">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="t-ui text-ink">
                        {d.area ? AREA_LABEL[d.area] : "Todas as áreas"} · {d.total} questões
                      </span>
                      <span className="t-meta text-ink-2">{d.open ? `aberto até ${fmtDay(d.closesAt)}` : "fechado"}</span>
                    </span>
                    {d.players.length === 0 ? (
                      <span className="t-meta text-ink-2">Ninguém jogou ainda.</span>
                    ) : (
                      d.players.slice(0, 3).map((p) => <DuelStrip key={p.nickname} player={p} total={d.total} revealed={d.revealed} />)
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-8">
          <section aria-labelledby="convidar" className="flex flex-col gap-3">
            <h2 id="convidar" className="t-kicker">
              Convidar
            </h2>
            <InviteCode code={g.inviteCode} />
            <p className="t-meta text-ink-2">Quem tiver o código entra em Grupos → Entrar com um código.</p>
          </section>
          <section aria-labelledby="pessoas" className="flex flex-col gap-2">
            <h2 id="pessoas" className="t-kicker">
              Pessoas
            </h2>
            <ul className="flex flex-col">
              {g.members.map((m) => (
                <li key={m.nickname} className="border-b border-line-subtle py-2 t-ui">
                  {m.nickname}
                  {m.me && <span className="t-meta text-ink-2"> (você)</span>}
                </li>
              ))}
            </ul>
          </section>
          <LeaveGroup groupId={g.id} />
        </aside>
      </div>
    </>
  );
}
