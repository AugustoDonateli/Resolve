import Link from "next/link";
import { fmtStudy, ranking, type WeekBoard } from "@/lib/groups/week";

export interface DeskGroup {
  id: string;
  name: string;
  board: WeekBoard;
  others: number;
}

/**
 * Grupo na mesa: o placar da semana do grupo mais recente, com a sua posição, os três primeiros e quem está
 * estudando agora. Sem grupo, o convite para criar um. O tempo conta sozinho enquanto você estuda no site.
 */
export function GroupCard({ group }: { group: DeskGroup | null }) {
  if (!group)
    return (
      <section aria-labelledby="grupo-mesa" className="rounded-card border border-line-subtle bg-surface px-5 pb-5 pt-5 shadow-paper">
        <h2 id="grupo-mesa" className="t-kicker">
          Estudar com amigos
        </h2>
        <p className="mt-2 font-reading text-[22px] font-medium leading-tight text-ink">Crie um grupo</p>
        <p className="mt-1 t-meta text-ink-2">O site conta sozinho o seu tempo de estudo, e o grupo vê quem estudou mais na semana.</p>
        <Link href="/grupos" className="mt-4 inline-flex min-h-11 items-center rounded-control border-[1.5px] border-ink px-4 t-ui text-ink hover:bg-ink hover:text-background">
          Criar ou entrar num grupo
        </Link>
      </section>
    );
  const b = group.board;
  const rows = ranking(b.members);
  const me = b.members.find((m) => m.me);
  const pos = rows.findIndex((m) => m.me);
  const now = rows.filter((m) => m.studyingNow && !m.me);
  return (
    <section aria-labelledby="grupo-mesa" className="rounded-card border border-line-subtle bg-surface px-5 pb-5 pt-5 shadow-paper">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="grupo-mesa" className="t-kicker">
          Grupo · {group.name}
        </h2>
        <span className="t-kicker">esta semana</span>
      </div>
      <p className="mt-2 font-reading text-[20px] font-medium leading-snug text-ink">
        {me?.sharing && pos >= 0
          ? `Você está em ${pos + 1}º, com ${fmtStudy(me.minutes ?? 0)}.`
          : `Seu tempo: ${fmtStudy(me?.minutes ?? 0)} (fora do ranking).`}
      </p>
      {rows.length > 0 && (
        <ol className="mt-3 flex flex-col border-t border-line-subtle">
          {rows.slice(0, 3).map((m, i) => (
            <li key={m.nickname} className="flex items-baseline justify-between gap-3 border-b border-line-subtle py-1.5 t-ui">
              <span className="min-w-0 truncate">
                <span className="mr-2 font-display text-[18px] text-ink-2">{i + 1}</span>
                {m.me ? "Você" : m.nickname}
                {m.studyingNow && (
                  <span className="ml-2 inline-flex items-center gap-1 t-meta text-ink-2">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> estudando
                  </span>
                )}
              </span>
              <span className="tabular text-ink">{fmtStudy(m.minutes ?? 0)}</span>
            </li>
          ))}
        </ol>
      )}
      {now.length > 0 && <p className="mt-2 t-meta text-ink-2">Estudando agora: {now.map((m) => m.nickname).join(", ")}.</p>}
      <Link href={`/grupos/${group.id}`} className="mt-3 inline-flex min-h-11 items-center t-ui text-link underline">
        Ver o placar{group.others > 0 ? ` · e mais ${group.others} ${group.others === 1 ? "grupo" : "grupos"}` : ""}
      </Link>
    </section>
  );
}
