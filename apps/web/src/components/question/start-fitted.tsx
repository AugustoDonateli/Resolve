"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startFittedTraining } from "@/lib/study/actions";
import { AREA_LABEL } from "@/lib/study/question-types";

const noop = () => () => {};
const AREAS = ["LC", "CH", "CN", "MT"] as const;

/**
 * Treino na medida: escolhe a área e abre 10 questões ainda não respondidas, com dificuldade logo acima do
 * nível estimado da conta. Sem estimativa na área, explica o que falta em vez de abrir um treino qualquer.
 */
export function StartFitted({ initialArea }: { initialArea?: string }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [area, setArea] = useState<(typeof AREAS)[number]>(AREAS.includes(initialArea as (typeof AREAS)[number]) ? (initialArea as (typeof AREAS)[number]) : "LC");
  const [pending, start] = useTransition();
  const [error, setError] = useState<"faltam" | "acabou" | "outro" | null>(null);
  return (
    <form
      aria-label="Treino na medida"
      className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await startFittedTraining({ actionId: crypto.randomUUID(), area });
          if (r.ok) router.push(`/estudar/sessao/${r.value}`);
          else setError(r.error === "resolve_fit_needs_answers" ? "faltam" : r.error === "resolve_no_items" ? "acabou" : "outro");
        });
      }}
    >
      <label className="flex min-w-0 flex-col gap-1.5 t-ui">
        Área
        <select
          className="w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink"
          value={area}
          onChange={(e) => setArea(e.target.value as (typeof AREAS)[number])}
        >
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {AREA_LABEL[a]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" className="self-start" loading={pending} disabled={!hydrated}>
        Começar na minha medida
      </Button>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui text-ink">
            {error === "faltam" ? (
              <>
                Ainda não há medida para esta área: ela aparece com 10 questões respondidas. Faça um treino livre nela ou o{" "}
                <Link href="/diagnostico" className="text-link underline">
                  diagnóstico
                </Link>
                .
              </>
            ) : error === "acabou" ? (
              "Você já respondeu todas as questões desta área que têm dificuldade oficial."
            ) : (
              "Não foi possível começar. Tente de novo."
            )}
          </p>
        )}
      </div>
    </form>
  );
}
