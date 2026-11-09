"use client";

import { Pause, Play, Square } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { fmtDuration, KIND_LABEL, type StudyBlock } from "@/lib/demo/routine";
import { KindIcon } from "./kind-icon";

export interface FocusClock {
  startedAt: number;
  /** Tempo ativo acumulado antes do trecho atual. */
  accumulatedMs: number;
  /** Início do trecho atual; null quando pausado. */
  runningSince: number | null;
}

export function activeMs(c: FocusClock, now: number) {
  return c.accumulatedMs + (c.runningSince === null ? 0 : now - c.runningSince);
}

function mmss(ms: number) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${neg ? "+" : ""}${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Tela de foco (F1-T17): o cartão do bloco se expande até virar a área de
 * trabalho; a faixa lateral do cartão vira a margem da folha. Título e duração
 * conservam continuidade via layoutId. Sem animação contínua durante o bloco.
 */
export function FocusView({
  block,
  clock,
  onTogglePause,
  onEnd,
}: {
  block: StudyBlock;
  clock: FocusClock;
  onTogglePause: () => void;
  onEnd: () => void;
}) {
  const reduced = useReduced();
  const [now, setNow] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const T = { duration: reduced ? 0 : duration.evidence / 1000, ease: ease.layout };
  const elapsed = activeMs(clock, now);
  const remaining = block.minutes * 60_000 - elapsed;
  const paused = clock.runningSince === null;

  return (
    <motion.section
      layoutId={`card-${block.id}`}
      transition={T}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`focus-title-${block.id}`}
      className="fixed inset-0 z-50 overflow-auto bg-surface"
      style={{ borderRadius: 0 }}
    >
      {/* A faixa do cartão vira a margem da folha. */}
      <motion.span
        layoutId={`stripe-${block.id}`}
        transition={T}
        aria-hidden="true"
        className="absolute inset-y-0 left-6 w-0.5 bg-primary sm:left-12 md:left-20"
      />
      <div className="relative flex min-h-full max-w-[880px] flex-col pb-[calc(2rem+env(safe-area-inset-bottom))] pl-12 pr-5 pt-[calc(2rem+env(safe-area-inset-top))] sm:pl-24 sm:pr-8 md:pl-32 md:py-16">
        <motion.div
          layout="position"
          className="flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ delay: reduced ? 0 : 0.22, duration: reduced ? 0 : duration.layout / 1000, ease: ease.state }}
        >
          <span className="inline-flex items-center gap-2 t-meta text-ink-2">
            <KindIcon kind={block.kind} />
            Foco · {KIND_LABEL[block.kind]}
          </span>
          <DemoBadge>Bloco demonstrativo</DemoBadge>
        </motion.div>

        <motion.h2
          ref={headingRef}
          tabIndex={-1}
          id={`focus-title-${block.id}`}
          layoutId={`title-${block.id}`}
          transition={T}
          className="mt-6 t-section text-ink outline-none"
        >
          {block.title}
        </motion.h2>
        <motion.span layoutId={`dur-${block.id}`} transition={T} className="mt-2 inline-flex self-start rounded-full bg-surface-subtle px-2.5 py-0.5 t-meta tabular text-ink">
          {fmtDuration(block.minutes)}
        </motion.span>

        <motion.div
          layout="position"
          className="mt-10 flex flex-1 flex-col"
          initial={{ opacity: 0, y: reduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ delay: reduced ? 0 : 0.26, duration: reduced ? 0 : duration.layout / 1000, ease: ease.state }}
        >
          <p className="t-reading text-ink-2">{block.detail}</p>
          <div className="mt-8" role="timer" aria-live="off">
            <p className="t-meta text-ink-2">{remaining >= 0 ? "Restante" : "Além do planejado"}</p>
            <p className="font-medium tabular text-ink" style={{ fontSize: "clamp(56px, 14vw, 104px)", lineHeight: 1 }}>
              {mmss(remaining)}
            </p>
            <p className="mt-2 t-meta tabular text-ink-2">
              Tempo ativo {mmss(elapsed)} {paused && "· pausado"}
            </p>
          </div>
          <p className="sr-only" aria-live="polite">
            {paused ? "Bloco pausado" : ""}
          </p>

          <div className="mt-auto flex flex-wrap gap-3 pt-12">
            <Button variant="secondary" onClick={onTogglePause} icon={paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}>
              {paused ? "Retomar" : "Pausar"}
            </Button>
            <Button onClick={onEnd} icon={<Square aria-hidden className="size-4" />}>
              Encerrar bloco
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
