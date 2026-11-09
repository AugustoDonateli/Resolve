"use client";

import { motion } from "motion/react";
import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";

/**
 * Traço azul à mão (M04): sublinha cada linha do trecho com um traço levemente
 * irregular, desenhado da esquerda para a direita, linha após linha.
 * Usa o azul de link/foco para manter contraste também no escuro.
 */
export function PenStroke({ scopeRef, anchor, strokeKey }: { scopeRef: RefObject<HTMLElement | null>; anchor: string | null; strokeKey: string }) {
  const reduced = useReduced();
  const [lines, setLines] = useState<{ x: number; y: number; w: number }[]>([]);

  const measure = useCallback(() => {
    const scope = scopeRef.current;
    if (!scope || !anchor) {
      setLines([]);
      return;
    }
    const el = scope.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
    if (!el) return setLines([]);
    const base = scope.getBoundingClientRect();
    const rects = Array.from(el.getClientRects()).filter((r) => r.width > 4);
    setLines(rects.map((r) => ({ x: r.left - base.left, y: r.bottom - base.top - 1, w: r.width })));
  }, [scopeRef, anchor]);

  useLayoutEffect(() => {
    measure();
    const scope = scopeRef.current;
    if (!scope) return;
    const ro = new ResizeObserver(measure);
    ro.observe(scope);
    return () => ro.disconnect();
  }, [measure, scopeRef]);

  if (!lines.length) return null;
  const total = lines.reduce((s, l) => s + l.w, 0);
  const totalDur = duration.evidence / 1000;
  const offsets = lines.map((_, i) => lines.slice(0, i).reduce((s, l) => s + l.w, 0));

  return (
    <svg key={strokeKey} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {lines.map((l, i) => {
        const share = l.w / total;
        const delay = ((offsets[i] ?? 0) / total) * totalDur;
        // Traço com pequena ondulação e leve subida no fim, como caneta.
        const seg = Math.max(2, Math.round(l.w / 40));
        let d = `M ${l.x} ${l.y + 1}`;
        for (let k = 1; k <= seg; k++) {
          const x = l.x + (l.w * k) / seg;
          const y = l.y + (k % 2 ? 1.6 : 0.2) - (k === seg ? 1.2 : 0);
          const cx = l.x + (l.w * (k - 0.5)) / seg;
          d += ` Q ${cx} ${l.y + (k % 2 ? -0.4 : 2)} ${x} ${y}`;
        }
        return (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="var(--rs-link-focus)"
            strokeWidth={2.25}
            strokeLinecap="round"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : Math.max(0.12, totalDur * share), delay: reduced ? 0 : delay + 0.04, ease: ease.evidence }}
          />
        );
      })}
    </svg>
  );
}
