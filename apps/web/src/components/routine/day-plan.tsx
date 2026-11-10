"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { fmtClock, fmtDuration } from "@/lib/demo/routine";
import { generateDayPlan } from "@/lib/routine/plan-actions";
import type { DayPlan } from "@/lib/routine/plan";

const noop = () => () => {};
const STATUS: Record<string, string> = {
  em_curso: "em curso",
  concluido: "concluído",
  remarcado: "remarcado",
  dispensado: "dispensado",
};

/**
 * Plano de hoje (F4-T15): monta blocos nos horários livres, sem tocar em compromissos, e mostra o que
 * ficou de fora com o motivo. Só muda quando o aluno pede ("Montar" ou "Refazer").
 */
export function DayPlanPanel({ plan }: { plan: DayPlan }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const made = plan.generatedAt !== null;
  return (
    <section
      aria-labelledby="plano-hoje"
      className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
    >
      <h2 id="plano-hoje" className="t-section">
        Plano de hoje
      </h2>
      <p className="max-w-2xl t-meta text-ink-2">
        Usa seus horários livres a partir de agora, sem encostar nos
        compromissos: revisão vencida primeiro, depois as metas. Blocos de até
        50 min com 5 min entre eles.
      </p>
      {plan.blocks.length > 0 ? (
        <ol className="flex flex-col divide-y divide-line-subtle">
          {plan.blocks.map((b) => (
            <li key={b.id} className="flex flex-col gap-0.5 py-2">
              <p className="t-ui">
                <span className="tabular-nums">
                  {fmtClock(b.start_minute)}–
                  {fmtClock(b.start_minute + b.planned_minutes)}
                </span>{" "}
                · {b.title}{" "}
                <span className="t-meta text-ink-2">
                  ({fmtDuration(b.planned_minutes)}
                  {STATUS[b.status] ? `, ${STATUS[b.status]}` : ""})
                </span>
              </p>
              {b.reason && <p className="t-meta text-ink-2">{b.reason}</p>}
            </li>
          ))}
        </ol>
      ) : made ? (
        <p className="t-ui">Nenhum bloco coube hoje.</p>
      ) : null}
      {plan.leftOut.length > 0 && (
        <div>
          <h3 className="mb-1 t-ui font-semibold">Ficou de fora</h3>
          <ul className="flex flex-col gap-1">
            {plan.leftOut.map((l, i) => (
              <li key={i} className="t-meta">
                {"note" in l
                  ? l.note
                  : `${l.title} (${fmtDuration(l.minutes)}): ${l.why}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button
        type="button"
        className="self-start"
        variant={made ? "secondary" : "primary"}
        loading={pending}
        disabled={!hydrated}
        onClick={() =>
          start(async () => {
            const r = await generateDayPlan();
            setMsg(
              r.ok
                ? { ok: true, text: "Plano montado." }
                : { ok: false, text: r.message },
            );
            if (r.ok) router.refresh();
          })
        }
      >
        {made ? "Refazer plano de hoje" : "Montar plano de hoje"}
      </Button>
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
