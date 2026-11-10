"use client";

import { motion } from "motion/react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";

export interface RulerMark {
  value: number;
  lower: number;
  upper: number;
}

/**
 * Régua TRI (M02): faixa e marcador ligados ao cálculo; um cenário por vez, como segundo marcador.
 * Os números ficam fora do movimento (texto estável); só marcador e faixa deslizam depois de uma ação.
 */
export function Ruler({
  min,
  max,
  base,
  scenario,
  unit,
  label,
}: {
  min: number;
  max: number;
  base: RulerMark;
  scenario?: RulerMark | null;
  unit: string;
  label: string;
}) {
  const reduced = useReduced();
  // Porcentagens arredondadas e sem calc(): o HTML do servidor e o do navegador ficam idênticos.
  const num = (v: number) => Math.round(Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) * 100) / 100;
  const pct = (v: number) => `${num(v)}%`;
  const T = { duration: reduced ? 0 : duration.evidence / 1000, ease: ease.evidence };
  const ticks = Array.from({ length: 7 }, (_, i) => min + ((max - min) * i) / 6);
  const fmt = (v: number) => (Math.abs(max - min) > 50 ? Math.round(v).toString() : v.toFixed(1).replace(".", ","));
  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div className="relative h-16">
        {/* trilho com marcas de régua */}
        <div className="absolute inset-x-0 top-9 h-px bg-line" />
        {ticks.map((t, i) => (
          <span key={i} className="absolute top-7 h-2 w-px bg-line" style={{ left: pct(t) }} aria-hidden />
        ))}
        {/* faixa posterior da base */}
        <motion.div
          className="absolute top-[30px] h-3.5 rounded-full bg-mark-yellow"
          initial={false}
          animate={{ left: pct(base.lower), width: `${Math.round((num(base.upper) - num(base.lower)) * 100) / 100}%` }}
          transition={T}
          aria-hidden
        />
        <motion.div className="absolute top-3 flex -translate-x-1/2 flex-col items-center" initial={false} animate={{ left: pct(base.value) }} transition={T}>
          <span className="t-meta font-medium tabular text-ink">{fmt(base.value)}</span>
          <span className="mt-0.5 h-6 w-0.5 rounded-full bg-ink" aria-hidden />
        </motion.div>
        {scenario && (
          <motion.div
            className="absolute top-[38px] flex -translate-x-1/2 flex-col items-center"
            initial={{ left: pct(base.value), opacity: 0 }}
            animate={{ left: pct(scenario.value), opacity: 1 }}
            transition={T}
          >
            <span className="h-5 w-0.5 rounded-full bg-link" aria-hidden />
            <span className="t-meta font-medium tabular text-link">{fmt(scenario.value)}</span>
          </motion.div>
        )}
      </div>
      <div className="relative h-4 t-meta tabular text-ink-2" aria-hidden>
        {ticks.map((t, i) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
            {fmt(t)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {label}: {fmt(base.value)} {unit}, faixa de {fmt(base.lower)} a {fmt(base.upper)}
        {scenario ? `; cenário: ${fmt(scenario.value)}, faixa de ${fmt(scenario.lower)} a ${fmt(scenario.upper)}` : ""}.
      </figcaption>
    </figure>
  );
}
