"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applaudMember, setTimeSharing, setWeeklyGoal } from "@/lib/groups/actions";
import { evolution, fmtStudy, goalProgress, ranking, recapLines, weekLabel, type WeekBoard as Board, type WeekRecap } from "@/lib/groups/week";

/**
 * Placar da semana do grupo: quem escolheu participar, em ordem de tempo de estudo medido pelo Resolve.
 * Mostra só apelido e totais da semana; cada pessoa decide se aparece, e sempre vê o próprio tempo.
 * A meta coletiva soma o tempo de quem participa.
 */
export function WeekBoard({ groupId, board, recap }: { groupId: string; board: Board; recap: WeekRecap | null }) {
  const router = useRouter();
  const uid = useId();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [hours, setHours] = useState(board.goalMinutes ? String(Math.round(board.goalMinutes / 60)) : "");
  const me = board.members.find((m) => m.me);
  const rows = ranking(board.members);
  const out = board.members.filter((m) => !m.sharing && !m.me);
  const progress = goalProgress(board.totalMinutes, board.goalMinutes);
  const last = recap ? recapLines(recap) : [];
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setMessage(r.message ?? "Não foi possível agora. Tente de novo.");
    });

  return (
    <section aria-labelledby="placar" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="placar" className="t-section">
          Placar da semana
        </h2>
        <p className="t-kicker">{weekLabel(board.weekStart)}</p>
      </div>

      {board.goalMinutes !== null && progress !== null && (
        <div>
          <p className="mb-1.5 t-ui text-ink">
            Meta do grupo: {fmtStudy(board.totalMinutes)} de {fmtStudy(board.goalMinutes)}
            {progress >= 1 && <span className="t-meta text-ink-2"> · meta batida</span>}
          </p>
          <div aria-hidden="true" className="h-3 border-[1.5px] border-ink">
            <div className="h-full bg-ink" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="max-w-xl t-reading text-ink-2">Ninguém está no ranking deste grupo agora. Quem marcar a opção abaixo volta a aparecer com o tempo de estudo da semana.</p>
      ) : (
        <ol className="flex flex-col border-t-[1.5px] border-ink">
          {rows.map((m, i) => {
            const delta = evolution(m.minutes, m.previousMinutes);
            return (
              <li key={m.nickname} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line-subtle py-3">
                <span aria-hidden="true" className="font-display text-[30px] leading-none text-ink-2">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="t-ui text-ink">
                    <span className="sr-only">{i + 1}º lugar: </span>
                    {m.nickname}
                    {m.me && <span className="t-meta text-ink-2"> (você)</span>}
                    {m.studyingNow && (
                      <span className="ml-2 inline-flex items-center gap-1.5 t-meta text-ink">
                        <span aria-hidden="true" className="size-2 rounded-full bg-primary" /> estudando agora
                      </span>
                    )}
                  </p>
                  <p className="t-meta text-ink-2">
                    {m.questions ?? 0} {m.questions === 1 ? "questão" : "questões"} · {m.daysActive ?? 0} {m.daysActive === 1 ? "dia" : "dias"} com estudo
                    {delta ? ` · ${delta}` : ""}
                    {m.applause ? ` · ${m.applause} ${m.applause === 1 ? "aplauso" : "aplausos"}` : ""}
                  </p>
                  {!m.me && me?.sharing && m.userId && (
                    <div className="-ml-3 mt-1 flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || Boolean(m.applaudedByMe)}
                        onClick={() => run(() => applaudMember({ groupId, userId: m.userId }))}
                      >
                        {m.applaudedByMe ? "Você aplaudiu" : "Aplaudir"}
                        <span className="sr-only"> {m.nickname}</span>
                      </Button>
                    </div>
                  )}
                </div>
                <p className="t-metric tabular text-ink">{fmtStudy(m.minutes ?? 0)}</p>
              </li>
            );
          })}
        </ol>
      )}
      {out.length > 0 && <p className="t-meta text-ink-2">Fora do ranking por escolha: {out.map((m) => m.nickname).join(", ")}.</p>}

      {recap && last.length > 0 && (
        <div className="rounded-card border border-line-subtle bg-surface p-4 shadow-paper sm:p-5">
          <h3 className="t-kicker">Semana passada · {weekLabel(recap.weekStart)}</h3>
          <ul className="mt-2 flex flex-col gap-1 t-reading text-ink">
            {last.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {me && (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-start gap-3 t-ui text-ink">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--rs-primary)]"
              checked={me.sharing}
              disabled={pending}
              onChange={(e) => run(() => setTimeSharing({ groupId, share: e.target.checked }))}
            />
            <span>
              Aparecer no ranking de tempo deste grupo
              <span className="block t-meta text-ink-2">
                Todo mundo do grupo entra no ranking, sem precisar desafiar ninguém. Os colegas veem só o seu apelido, o tempo da semana, quantas questões
                você respondeu e se está estudando agora. Nada do seu plano, das suas notas ou das suas respostas. Se preferir, desmarque.
              </span>
            </span>
          </label>
          {!me.sharing && (
            <p className="t-meta text-ink-2">
              Seu tempo nesta semana: <span className="font-medium text-ink">{fmtStudy(me.minutes ?? 0)}</span> (só você vê).
            </p>
          )}
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(hours);
          if (!Number.isInteger(n) || n < 1 || n > 1000) return setMessage("A meta vai de 1 a 1000 horas por semana.");
          run(() => setWeeklyGoal({ groupId, hours: n }));
        }}
      >
        <label htmlFor={`${uid}-meta`} className="flex flex-col gap-1 t-meta text-ink-2">
          Meta do grupo na semana (horas somadas)
          <input
            id={`${uid}-meta`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="min-h-11 w-28 rounded-control border border-line bg-surface px-3 t-ui text-ink"
          />
        </label>
        <Button type="submit" variant="secondary" loading={pending}>
          {board.goalMinutes === null ? "Definir meta" : "Mudar meta"}
        </Button>
        {board.goalMinutes !== null && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setHours("");
              run(() => setWeeklyGoal({ groupId, hours: null }));
            }}
          >
            Tirar meta
          </Button>
        )}
      </form>
      <div aria-live="polite">
        {message && (
          <p role="alert" className="t-ui text-ink">
            {message}
          </p>
        )}
      </div>

      <details className="max-w-xl">
        <summary className="min-h-11 cursor-pointer t-ui text-link underline">Como o tempo é contado</summary>
        <p className="mt-1 t-meta text-ink-2">
          O site conta sozinho o tempo em que você está estudando nele: resolvendo questões, revisando, escrevendo a redação, no simulado, no
          diagnóstico ou num bloco de foco. Para de contar com a aba escondida ou depois de 3 minutos sem mexer na página. Ninguém digita horas, e o que
          se sobrepõe conta uma vez só. Limite de 12 horas por dia. A semana vai de segunda a domingo, no horário de Brasília.
        </p>
      </details>
    </section>
  );
}
