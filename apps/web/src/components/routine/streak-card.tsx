"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addDays, dayLabel } from "@/lib/routine/schedule-types";
import type { StreakView } from "@/lib/routine/streak";
import { markRest, unmarkRest } from "@/lib/routine/streak-actions";

/**
 * Sequência e folga (F4-T18). A regra fica escrita na tela; cada dia diz em texto se foi ativo, folga
 * ou vazio (a forma do marcador repete a informação, a cor não é a única pista).
 */
export function StreakCard({ s }: { s: StreakView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (
    fn: () => Promise<{ ok: true } | { ok: false; message: string }>,
    okText: string,
  ) =>
    start(async () => {
      const r = await fn();
      setMsg(
        r.ok ? { ok: true, text: okText } : { ok: false, text: r.message },
      );
      if (r.ok) router.refresh();
    });
  const tomorrow = addDays(s.today, 1);
  return (
    <section
      aria-labelledby="sequencia"
      className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
    >
      <h2 id="sequencia" className="t-section">
        Sequência: {s.streak} {s.streak === 1 ? "dia" : "dias"}
      </h2>
      <p className="max-w-2xl t-meta text-ink-2">
        Regra da plataforma ({s.ruleVersion}): conta dias seguidos com estudo
        (questão, revisão, bloco concluído ou rascunho de redação). Folga
        planejada, marcada para hoje ou para frente, não quebra a sequência nem
        soma; até 2 por semana. Um dia sem nada quebra; o dia de hoje só conta
        quando você estuda.
      </p>
      <ol aria-label="Últimos 14 dias" className="flex flex-wrap gap-1.5">
        {s.lastDays.map((d) => {
          const state = d.active ? "ativo" : d.rest ? "folga" : "vazio";
          return (
            <li key={d.day} className="flex flex-col items-center gap-0.5">
              <span
                aria-hidden="true"
                className={
                  d.active
                    ? "grid size-7 place-items-center rounded-full bg-ink text-[11px] text-background"
                    : d.rest
                      ? "grid size-7 place-items-center rounded-full border border-ink text-[11px] text-ink"
                      : "grid size-7 place-items-center rounded-full border border-line-subtle text-[11px] text-ink-2"
                }
              >
                {d.active ? "✓" : d.rest ? "F" : ""}
              </span>
              <span className="t-meta text-ink-2 tabular-nums">
                {d.day.slice(8, 10)}
              </span>
              <span className="sr-only">
                {dayLabel(d.day)}: {state}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="t-meta text-ink-2">
        ✓ estudou · F folga · vazio sem estudo · {s.restThisWeek} de 2 folgas
        nesta semana
      </p>
      <div className="flex flex-wrap gap-3">
        {!s.upcomingRest.includes(s.today) && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => markRest({ date: s.today }), "Folga de hoje marcada.")
            }
          >
            Marcar folga hoje
          </Button>
        )}
        {!s.upcomingRest.includes(tomorrow) && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => markRest({ date: tomorrow }),
                "Folga de amanhã marcada.",
              )
            }
          >
            Marcar folga amanhã
          </Button>
        )}
      </div>
      {s.upcomingRest.length > 0 && (
        <ul className="flex flex-col gap-2">
          {s.upcomingRest.map((d) => (
            <li key={d} className="flex flex-wrap items-center gap-3 t-ui">
              Folga em {dayLabel(d)}
              {d > s.today ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() => unmarkRest({ date: d }), "Folga desmarcada.")
                  }
                >
                  Desmarcar
                </Button>
              ) : (
                <span className="t-meta text-ink-2">(fica no histórico)</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite">
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="t-ui">
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
