"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { eap, scenario, type ItemParameters, type ModelConfig, type Response } from "@/lib/tri/engine";
import { Ruler } from "./ruler";

export interface EstimateInput {
  config: ModelConfig;
  data: { itemId: string; correct: boolean; a: number; b: number; c: number; label?: string }[];
  unit: string;
  /** Rótulo honesto da faixa: posterior do modelo, não calibrada. */
  bandLabel: string;
}

/**
 * Estimativa e cenários com o mesmo motor: escolher um erro e ver o conjunto inteiro recalculado como se
 * ele fosse acerto. Um cenário por vez; a diferença não é uma parcela somável a outros cenários.
 */
export function AreaEstimate({ input }: { input: EstimateInput }) {
  const params = useMemo(() => new Map<string, ItemParameters>(input.data.map((d) => [d.itemId, { a: d.a, b: d.b, c: d.c }])), [input.data]);
  const responses: Response[] = useMemo(() => input.data.map((d) => ({ itemId: d.itemId, correct: d.correct })), [input.data]);
  const base = useMemo(() => eap(responses, params, input.config), [responses, params, input.config]);
  const wrong = input.data.filter((d) => !d.correct);
  const [pick, setPick] = useState<string | null>(null);
  const sc = useMemo(
    () => (pick ? scenario(responses, params, input.config, { label: pick, changes: [{ itemId: pick, correct: true }] }) : null),
    [pick, responses, params, input.config],
  );
  const t = input.config.transform;
  const toScale = (v: number) => (t ? t.intercept + t.slope * v : v);
  const min = toScale(input.config.quadrature.from / 2);
  const max = toScale(input.config.quadrature.to / 2);
  const fmt = (v: number) => (t ? Math.round(v).toString() : v.toFixed(2).replace(".", ","));
  return (
    <div className="flex flex-col gap-4">
      <Ruler
        min={min}
        max={max}
        unit={input.unit}
        label="Estimativa e faixa"
        base={{ value: base.score, lower: base.lower, upper: base.upper }}
        scenario={sc ? { value: sc.estimate.score, lower: sc.estimate.lower, upper: sc.estimate.upper } : null}
      />
      <p className="t-meta text-ink-2">
        <span className="tabular text-ink">{fmt(base.score)}</span> {input.unit} · faixa {fmt(base.lower)} a {fmt(base.upper)} ({input.bandLabel}) ·{" "}
        {base.nUsed} {base.nUsed === 1 ? "questão" : "questões"} no cálculo
      </p>
      {wrong.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 t-ui">E se você tivesse acertado…</legend>
          <div className="flex flex-wrap gap-2">
            {wrong.map((w) => (
              <label
                key={w.itemId}
                className={clsx(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 t-meta",
                  pick === w.itemId ? "border-ink bg-surface text-ink" : "border-line-subtle text-ink-2 hover:border-line",
                )}
              >
                <input
                  type="radio"
                  name={`cenario-${input.data[0]?.itemId}`}
                  className="sr-only"
                  checked={pick === w.itemId}
                  onChange={() => setPick(w.itemId)}
                />
                {w.label ?? `questão ${w.itemId.slice(0, 4)}`}
              </label>
            ))}
            {pick && (
              <button type="button" className="min-h-11 rounded-control px-3 t-meta text-link underline" onClick={() => setPick(null)}>
                Limpar cenário
              </button>
            )}
          </div>
          <p className="t-meta text-ink-2" aria-live="polite">
            {sc
              ? `Com esse acerto, o conjunto inteiro recalculado dá ${fmt(sc.estimate.score)} (${sc.delta >= 0 ? "+" : ""}${fmt(sc.delta)}). Cada cenário é recalculado sozinho: as diferenças não se somam.`
              : "Escolha um erro para ver o conjunto recalculado."}
          </p>
        </fieldset>
      )}
    </div>
  );
}
