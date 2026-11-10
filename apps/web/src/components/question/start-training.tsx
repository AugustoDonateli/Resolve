"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startTraining } from "@/lib/study/actions";
import { AREA_LABEL } from "@/lib/study/question-types";

const selectCls =
  "w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";
const noop = () => () => {};

/** Escolha do treino livre: área e quantidade; abre a sessão e leva à primeira questão. */
export function StartTraining({
  counts,
  mode = "treino",
}: {
  counts: Record<string, number>;
  mode?: "treino" | "triagem";
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [area, setArea] = useState("todas");
  const [count, setCount] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const available = area === "todas" ? total : (counts[area] ?? 0);
  return (
    <form
      aria-label={mode === "triagem" ? "Começar triagem" : "Começar treino"}
      className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await startTraining({
            actionId: crypto.randomUUID(),
            area,
            count: Number(count),
          });
          if (r.ok)
            router.push(
              mode === "triagem"
                ? `/estudar/triagem/${r.value}`
                : `/estudar/sessao/${r.value}`,
            );
          else
            setError(
              r.error === "resolve_no_items"
                ? "Não há questões publicadas nessa área ainda."
                : "Não foi possível começar. Tente de novo.",
            );
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 t-ui">
          Área
          <select
            className={selectCls}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="todas">Todas ({total})</option>
            {(Object.keys(AREA_LABEL) as (keyof typeof AREA_LABEL)[]).map(
              (k) => (
                <option key={k} value={k} disabled={!counts[k]}>
                  {AREA_LABEL[k]} ({counts[k] ?? 0})
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 t-ui">
          Quantidade
          <select
            className={selectCls}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          >
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n} questões
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="t-meta text-ink-2">
        {available < Number(count)
          ? `Há ${available} publicada(s) nessa escolha; o treino terá ${available}.`
          : "Primeiro as questões que você ainda não respondeu."}
      </p>
      <Button
        type="submit"
        className="self-start"
        loading={pending}
        disabled={!hydrated || available === 0}
      >
        {mode === "triagem" ? "Começar triagem" : "Começar treino"}
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
