"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startRhythm } from "@/lib/study/actions";
import { BLOCKS, DEFAULT_CONFIG, questionsFor } from "@/lib/study/rhythm";

const noop = () => () => {};

/** Escolha do bloco de ritmo (F4-T06). A duração integral da prova fica para o Dia D. */
export function StartRhythm({ available }: { available: number }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState<15 | 45 | 90 | 180>(15);
  const [error, setError] = useState<string | null>(null);
  const count = questionsFor(minutes, DEFAULT_CONFIG, available);
  return (
    <form
      aria-label="Começar bloco de ritmo"
      className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await startRhythm({
            actionId: crypto.randomUUID(),
            minutes,
            count,
          });
          if (r.ok) router.push(`/estudar/ritmo/${r.value}`);
          else
            setError(
              r.error === "resolve_no_items"
                ? "Não há questões publicadas ainda."
                : "Não foi possível começar. Tente de novo.",
            );
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 t-ui">Duração</legend>
        {BLOCKS.map((b) => (
          <label
            key={b.minutes}
            className="flex min-h-11 items-center gap-2 t-ui"
          >
            <input
              type="radio"
              name="bloco"
              checked={minutes === b.minutes}
              onChange={() => setMinutes(b.minutes)}
              className="size-4 accent-[var(--rs-text)]"
            />
            {b.label}
          </label>
        ))}
      </fieldset>
      <p className="t-meta text-ink-2">
        {count} {count === 1 ? "questão" : "questões"} pelo alvo de{" "}
        {DEFAULT_CONFIG.targetMin} min cada. O prazo não pausa. A duração
        integral da prova fica para o Dia D.
      </p>
      <Button
        type="submit"
        className="self-start"
        loading={pending}
        disabled={!hydrated || available === 0}
      >
        Começar bloco
      </Button>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
