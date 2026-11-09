"use client";

import { gsap } from "gsap";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { bezierFn, duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";

export interface Stage {
  id: string;
  number: string;
  title: string;
  body: ReactNode;
}

const stageEase = bezierFn(ease.stage);

/**
 * Passagem entre etapas (motivo adicional ao M01–M09; protótipo F1-T11).
 * Uma folha azul sobe e cobre a tela; no ponto de cobertura a etapa troca;
 * a folha sai por cima e revela a etapa seguinte. Número e título ficam no
 * mesmo lugar do título da página, conservando continuidade.
 * Duração total ≤ 700 ms. Interromper (novo clique, Esc, troca de rota)
 * finaliza imediatamente no estado de destino — nunca numa tela presa.
 */
export function StagePassage({ stages }: { stages: Stage[] }) {
  const reduced = useReduced();
  const [index, setIndex] = useState(0);
  const [sheetLabel, setSheetLabel] = useState<Stage | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTitleRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const pending = useRef<number | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const finish = useCallback(() => {
    if (!tl.current) return;
    tl.current.kill();
    tl.current = null;
    if (pending.current !== null) setIndex(pending.current);
    pending.current = null;
    if (sheetRef.current) gsap.set(sheetRef.current, { clipPath: "inset(100% 0% 0% 0%)", visibility: "hidden" });
    setSheetLabel(null);
  }, []);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= stages.length) return;
      const interrupted = tl.current !== null;
      finish(); // clique repetido: conclui a passagem anterior antes da nova
      if (interrupted) setLog((l) => [`interrompida → estado final válido`, ...l].slice(0, 4));
      const target = stages[to]!;
      if (reduced || !sheetRef.current) {
        setIndex(to);
        return;
      }
      pending.current = to;
      setSheetLabel(target);
      const sheet = sheetRef.current;
      const t0 = performance.now();
      const half = duration.stage / 2000;
      tl.current = gsap
        .timeline({
          onComplete: () => {
            tl.current = null;
            setSheetLabel(null);
            gsap.set(sheet, { visibility: "hidden" });
            setLog((l) => [`passagem ${Math.round(performance.now() - t0)} ms`, ...l].slice(0, 4));
          },
        })
        .set(sheet, { visibility: "visible", clipPath: "inset(100% 0% 0% 0%)" })
        .to(sheet, { clipPath: "inset(0% 0% 0% 0%)", duration: half, ease: stageEase })
        .fromTo(sheetTitleRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: half * 0.9, ease: stageEase }, "<0.04")
        .add(() => {
          // Ponto de cobertura: a etapa de destino passa a ser a atual.
          setIndex(to);
          pending.current = null;
        })
        .to(sheet, { clipPath: "inset(0% 0% 100% 0%)", duration: half, ease: stageEase })
        .to(sheetTitleRef.current, { y: -16, opacity: 0, duration: half * 0.6, ease: stageEase }, "<");
    },
    [finish, reduced, stages],
  );

  // Esc e desmontagem também finalizam no estado de destino.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      tl.current?.kill();
    };
  }, [finish]);

  // Alinha o título da folha ao título da etapa (mesma posição na tela).
  useLayoutEffect(() => {
    if (!sheetLabel || !titleRef.current || !sheetTitleRef.current) return;
    const r = titleRef.current.getBoundingClientRect();
    gsap.set(sheetTitleRef.current, { left: r.left, top: r.top - 48 });
  }, [sheetLabel]);

  // Foco na nova etapa após a troca.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [index]);

  const s = stages[index]!;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => go(index - 1)} disabled={index === 0} icon={<ArrowLeft aria-hidden className="size-4" />}>
          Etapa anterior
        </Button>
        <Button size="sm" onClick={() => go(index + 1)} disabled={index === stages.length - 1} icon={<ArrowRight aria-hidden className="size-4" />}>
          Próxima etapa
        </Button>
        <span className="t-meta text-ink-2">Clique de novo durante a passagem ou tecle Esc para interromper.</span>
      </div>

      <section aria-labelledby="stage-title" className="paper-grain rounded-panel border border-line-subtle bg-surface p-6 sm:p-10">
        <p className="font-display text-[40px] leading-none text-ink-2 tabular">{s.number}</p>
        <h2 id="stage-title" ref={titleRef} tabIndex={-1} className="mt-2 t-screen outline-none">
          {s.title}
        </h2>
        <div className="mt-4 max-w-[60ch] t-reading text-ink-2">{s.body}</div>
      </section>

      <p className="mt-3 t-meta tabular text-ink-2" aria-live="polite">
        {log[0] ?? "Duração medida aparece aqui após cada passagem."}
      </p>

      {/* Folha azul: cobre a viewport inteira durante a passagem. */}
      <div ref={sheetRef} aria-hidden="true" className="invisible fixed inset-0 z-[60] bg-primary" style={{ clipPath: "inset(100% 0% 0% 0%)" }}>
        <div ref={sheetTitleRef} className="absolute text-on-primary">
          {sheetLabel && (
            <>
              <p className="font-display text-[40px] leading-none tabular opacity-80">{sheetLabel.number}</p>
              <p className="mt-2 t-screen">{sheetLabel.title}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
