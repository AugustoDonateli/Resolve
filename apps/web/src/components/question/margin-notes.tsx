"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";

export interface MarginNoteData {
  id: string;
  anchor: string;
  color: "yellow" | "pink";
  title: string;
  body: ReactNode;
}

const GAP = 12;

/**
 * Margem de anotações (PC). Cada nota nasce ao lado do trecho que explica:
 * um fio curto sai da borda do texto e a nota desliza da esquerda.
 * Posições acompanham a primeira linha do trecho; colisões empurram para baixo.
 */
export function MarginNotes({
  notes,
  scopeRef,
  selectedId,
  onSelect,
  className,
}: {
  notes: MarginNoteData[];
  /** Elemento que contém tanto o texto quanto a margem (referência de coordenadas). */
  scopeRef: RefObject<HTMLElement | null>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const reduced = useReduced();
  const marginRef = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const [tops, setTops] = useState<Record<string, number>>({});
  const [anchorTops, setAnchorTops] = useState<Record<string, number>>({});

  const measure = useCallback(() => {
    const scope = scopeRef.current;
    const margin = marginRef.current;
    if (!scope || !margin) return;
    const base = margin.getBoundingClientRect().top;
    const raw = notes
      .map((n) => {
        const el = scope.querySelector<HTMLElement>(`[data-anchor="${n.anchor}"]`);
        const rect = el?.getClientRects()[0];
        return { id: n.id, top: rect ? rect.top - base : 0 };
      })
      .sort((a, b) => a.top - b.top);
    const next: Record<string, number> = {};
    const anchors: Record<string, number> = {};
    let floor = -Infinity;
    for (const r of raw) {
      anchors[r.id] = r.top;
      const t = Math.max(r.top - 4, floor);
      next[r.id] = t;
      floor = t + (heights.current.get(r.id) ?? 96) + GAP;
    }
    setTops((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setAnchorTops((prev) => (JSON.stringify(prev) === JSON.stringify(anchors) ? prev : anchors));
  }, [notes, scopeRef]);

  useLayoutEffect(() => {
    measure();
    const scope = scopeRef.current;
    if (!scope) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(scope);
    return () => ro.disconnect();
  }, [measure, scopeRef]);

  const T = { duration: reduced ? 0 : duration.evidenceMin / 1000, ease: ease.evidence };

  return (
    <div ref={marginRef} className={clsx("relative", className)} aria-label="Anotações na margem" role="region">
      <AnimatePresence>
        {notes.map((n) => {
          const top = tops[n.id] ?? 0;
          const lineTop = (anchorTops[n.id] ?? 0) + 12 - top;
          return (
            <motion.div
              key={n.id}
              ref={(el) => {
                if (el) {
                  const h = el.offsetHeight;
                  if (heights.current.get(n.id) !== h) {
                    heights.current.set(n.id, h);
                    requestAnimationFrame(measure);
                  }
                }
              }}
              data-note={n.id}
              className="absolute inset-x-0"
              initial={{ opacity: 0, x: reduced ? 0 : -16, top }}
              animate={{ opacity: 1, x: 0, top }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.12 } }}
              transition={{ ...T, top: { duration: reduced ? 0 : duration.layout / 1000, ease: ease.layout } }}
            >
              {/* Fio que liga a nota ao trecho */}
              <motion.span
                aria-hidden="true"
                className="absolute -left-8 h-px w-8 origin-left bg-ink/40"
                style={{ top: Math.max(8, lineTop) }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={T}
              />
              <button
                type="button"
                onClick={() => onSelect?.(n.id)}
                aria-pressed={selectedId === n.id}
                className={clsx(
                  "block w-full rounded-card border bg-surface p-3 text-left transition-[border-color,box-shadow] duration-[var(--rs-dur-state)]",
                  selectedId === n.id ? "border-ink shadow-paper" : "border-line-subtle hover:border-line",
                )}
              >
                <span className="mb-1 flex items-center gap-2 t-meta font-medium text-ink">
                  <span aria-hidden="true" className={clsx("size-2.5 shrink-0 rounded-full", n.color === "yellow" ? "bg-mark-yellow" : "bg-mark-pink")} />
                  {n.title}
                </span>
                <span className="block t-meta text-ink-2">{n.body}</span>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Indica se um elemento está fora da área visível (para oferecer “Ir ao trecho”). */
export function isOffscreen(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom < 56 || r.top > window.innerHeight - 80;
}
