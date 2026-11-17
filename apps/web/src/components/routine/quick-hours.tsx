"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addStudyPreset } from "@/lib/routine/schedule-actions";

const PERIODS = [
  { value: "manha", label: "Manhã", range: "8h às 12h" },
  { value: "tarde", label: "Tarde", range: "14h às 18h" },
  { value: "noite", label: "Noite", range: "19h às 22h" },
] as const;

const chip =
  "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line px-3.5 t-ui text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-background has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--rs-link-focus)]";

/**
 * Horários rápidos: um toque marca o período como horário livre de estudo na semana. É o primeiro passo
 * de quem ainda não tem nenhum horário; os ajustes finos (outros horários, compromissos) ficam na Rotina.
 */
export function QuickHours({ className }: { className?: string }) {
  const router = useRouter();
  const uid = useId();
  const [days, setDays] = useState<"uteis" | "todos">("uteis");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className={className}>
      <fieldset>
        <legend className="t-ui text-ink">Em quais dias</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["uteis", "Segunda a sexta"],
              ["todos", "Todos os dias"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className={chip}>
              <input type="radio" name={`${uid}-dias`} className="sr-only" checked={days === value} onChange={() => setDays(value)} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 t-ui text-ink">Em qual período</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.value}
            variant="secondary"
            loading={pending && busy === p.value}
            disabled={pending}
            onClick={() => {
              setBusy(p.value);
              setMessage(null);
              start(async () => {
                const r = await addStudyPreset({ period: p.value, days });
                if (r.ok) router.refresh();
                else setMessage(r.message);
              });
            }}
          >
            {p.label} <span className="font-normal">({p.range})</span>
          </Button>
        ))}
      </div>
      <div aria-live="polite">
        {message && (
          <p role="alert" className="mt-3 t-ui text-ink">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
