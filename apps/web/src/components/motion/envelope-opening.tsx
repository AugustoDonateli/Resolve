"use client";

import { clsx } from "clsx";
import { gsap } from "gsap";
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { bezierFn, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";

/** Cadernos "carregados e mapeados" — aqui, dois cadernos DEMONSTRATIVOS. */
const BOOKLETS = [
  { id: "azul", label: "Azul", cover: "bg-primary text-on-primary", sub: "text-on-primary/80" },
  { id: "amarelo", label: "Amarelo", cover: "bg-mark-yellow text-on-mark", sub: "text-on-mark/75" },
] as const;

const PROVA_MS = 5.5 * 3600_000; // Dia 1, premissa do documento: 13h30–19h
const stageEase = bezierFn(ease.stage);
const softEase = bezierFn(ease.layout);

function hms(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Protótipo do envelope e caderno (M03; F1-T10). Formas 3D simples em CSS +
 * GSAP para testar enquadramento e ritmo (storyboard Q0–Q5, 5 s).
 * Pular está disponível desde o primeiro quadro. O cronômetro da prova fica
 * parado durante toda a cena e só inicia em “Começar prova”.
 */
export function EnvelopeOpening({ exam }: {
  exam?: { color: string; day: number; minutes: number; starting: boolean; onStart: () => void };
} = {}) {
  const reduced = useReduced();
  const [demoBooklet, setBooklet] = useState<(typeof BOOKLETS)[number]>(BOOKLETS[0]);
  const booklet = exam
    ? {
        ...(BOOKLETS.find((b) => b.label === exam.color) ?? { cover: "bg-surface text-ink", sub: "text-ink-2" }),
        label: exam.color,
      }
    : demoBooklet;
  const day = exam?.day ?? 1;
  const [phase, setPhase] = useState<"scene" | "ready" | "running">("scene");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [log, setLog] = useState("");
  const tl = useRef<gsap.core.Timeline | null>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const sealLRef = useRef<HTMLDivElement>(null);
  const sealRRef = useRef<HTMLDivElement>(null);
  const bookletRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  const build = useCallback(() => {
    tl.current?.kill();
    const t0 = performance.now();
    const t = gsap.timeline({
      paused: true,
      onComplete: () => {
        setPhase((p) => (p === "scene" ? "ready" : p));
        const elapsed = performance.now() - t0;
        // Conclusão instantânea (movimento reduzido ou pular) não é medição da cena.
        if (elapsed > 200) setLog((l) => l || `cena ${(elapsed / 1000).toFixed(2)} s`);
      },
    });
    // Q0 — estado inicial
    t.set(cameraRef.current, { scale: 1, y: 0 })
      .set(tiltRef.current, { rotationX: 22, rotationZ: -4, y: 0 })
      .set(envelopeRef.current, { y: 0, opacity: 1 })
      .set(flapRef.current, { rotationX: 0, z: 3 })
      .set([sealLRef.current, sealRRef.current], { x: 0, rotation: 0, opacity: 1 })
      .set(bookletRef.current, { y: 0, z: 1, scale: 1 })
      .set(shadowRef.current, { opacity: 0.18, scale: 1 });
    // Q1 0–1,2 s — aproximação lenta
    t.to(cameraRef.current, { scale: 1.08, duration: 1.2, ease: "none" }, 0);
    // Q2 1,2–2,2 s — lacre rompe e aba abre
    t.to(sealLRef.current, { x: -10, rotation: -14, opacity: 0, duration: 0.45, ease: softEase }, 1.2)
      .to(sealRRef.current, { x: 10, rotation: 14, opacity: 0, duration: 0.45, ease: softEase }, 1.2)
      .to(flapRef.current, { rotationX: 178, duration: 0.8, ease: stageEase }, 1.4)
      .set(flapRef.current, { z: -2 }, 1.8); // após 90°, a aba passa para trás do caderno
    // Q3 2,2–3,6 s — caderno sobe do envelope
    t.to(bookletRef.current, { y: "-44%", z: 6, duration: 1.4, ease: stageEase }, 2.2);
    // Q4 3,6–5,0 s — envelope sai, câmera alinha a capa
    t.to(envelopeRef.current, { y: "190%", duration: 1.0, ease: stageEase }, 3.6)
      .to(envelopeRef.current, { opacity: 0, duration: 0.3 }, 4.3)
      .to(shadowRef.current, { opacity: 0, duration: 0.6 }, 3.6)
      .to(tiltRef.current, { rotationX: 0, rotationZ: 0, duration: 1.4, ease: stageEase }, 3.6)
      .to(bookletRef.current, { y: "-6%", scale: 1.08, duration: 1.4, ease: stageEase }, 3.6)
      .to(cameraRef.current, { scale: 1, duration: 1.4, ease: stageEase }, 3.6);
    tl.current = t;
    return t;
  }, []);

  const run = useCallback(() => {
    const t = build();
    if (reduced) {
      t.progress(1);
      return;
    }
    t.play(0);
    requestAnimationFrame(() => skipRef.current?.focus({ preventScroll: true }));
  }, [build, reduced]);

  /** Rever cena: sorteia a variante somente entre cadernos carregados e mapeados. */
  const play = useCallback(() => {
    setBooklet(BOOKLETS[Math.floor(Math.random() * BOOKLETS.length)]!);
    setPhase("scene");
    setStartedAt(null);
    setLog("");
    run();
  }, [run]);

  // Primeira exibição: a variante inicial é fixa para não divergir da renderização do servidor.
  useLayoutEffect(() => {
    run();
    return () => {
      tl.current?.kill();
    };
  }, [run]);

  const skip = useCallback(() => {
    if (!tl.current) return;
    const p = tl.current.progress();
    tl.current.progress(1);
    if (p < 1) setLog(`pulada em ${(p * 5).toFixed(1)} s → capa final`);
  }, []);

  const start = () => {
    skip();
    if (exam) {
      exam.onStart();
      return;
    }
    setPhase("running");
    setStartedAt(Date.now());
    setNow(Date.now());
  };

  useEffect(() => {
    if (phase === "ready") startRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  const durationMs = exam ? exam.minutes * 60_000 : PROVA_MS;
  const remaining = startedAt ? durationMs - (now - startedAt) : durationMs;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="timer" aria-live="off" className="flex items-baseline gap-3">
          <span className="t-meta text-ink-2">Tempo de prova</span>
          <span data-testid="prova-timer" className="t-metric">{hms(remaining)}</span>
          <span className="t-meta text-ink-2" aria-live="polite">
            {phase === "running" ? "em curso" : "não iniciado"}
          </span>
        </div>
        {!exam && <DemoBadge>Caderno demonstrativo</DemoBadge>}
      </div>

      <div
        className="paper-grain relative h-[460px] overflow-hidden rounded-panel border border-line-subtle bg-surface-subtle sm:h-[540px]"
        style={{ perspective: 1100 }}
        aria-label="Cena de abertura do caderno"
        role="group"
      >
        <p className="sr-only" aria-live="polite">
          {phase === "scene" ? "Abrindo o envelope do caderno." : `Caderno ${booklet.label}, ${day}º dia. Pronto para começar.`}
        </p>
        <div ref={cameraRef} aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ transformStyle: "preserve-3d" }}>
          <div ref={tiltRef} className="relative w-[min(52%,260px)] aspect-[0.76]" style={{ transformStyle: "preserve-3d" }}>
            <div ref={shadowRef} aria-hidden="true" className="absolute -inset-x-4 -bottom-6 h-10 rounded-[50%] bg-ink blur-xl" />
            {/* Caderno: entre o fundo e o bolso do envelope */}
            <div
              ref={bookletRef}
              className={clsx("absolute inset-x-[6%] top-[4%] bottom-[3%] rounded-[6px] p-[8%] shadow-paper", booklet.cover)}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="flex h-full flex-col">
                <p className={clsx("text-[10px] font-medium uppercase leading-tight tracking-[0.1em] sm:text-[11px]", booklet.sub)}>Caderno de questões</p>
                <p className="mt-2 font-display text-[clamp(26px,6vw,40px)] leading-none">{day}º dia</p>
                <p className="mt-1 text-[13px] font-medium">Caderno {booklet.label}</p>
                <div className="mt-auto flex items-end justify-between gap-2">
                  <span className={clsx("text-[11px] leading-tight", booklet.sub)}>{exam ? "Dia D" : "Demonstração"}</span>
                  <span aria-hidden="true" className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className={clsx("size-2.5 rounded-full border border-current", i === 1 && "bg-current")} />
                    ))}
                  </span>
                </div>
              </div>
            </div>
            {/* Envelope */}
            <div ref={envelopeRef} className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
              <div className="absolute inset-0 rounded-[6px] border border-line-subtle bg-surface-subtle" style={{ transform: "translateZ(0px)" }} />
              <div
                className="absolute inset-0 rounded-[6px] bg-surface"
                style={{ transform: "translateZ(2px)", clipPath: "polygon(0 0.5%, 50% 40%, 100% 0.5%, 100% 100%, 0 100%)", boxShadow: "inset 0 0 0 1px var(--rs-border-subtle)" }}
              />
              <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ transform: "translateZ(2.5px)" }}>
                <path d="M0 0.5 L50 40 L100 0.5" fill="none" stroke="var(--rs-border-subtle)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              </svg>
              <div
                ref={flapRef}
                className="absolute inset-x-0 top-0 h-[42%] origin-top bg-surface-subtle"
                style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", boxShadow: "inset 0 0 0 1px var(--rs-border-subtle)" }}
              />
              {/* Lacre azul em duas metades */}
              <div className="absolute left-1/2 top-[38%] size-11" style={{ transform: "translate(-50%,-50%) translateZ(5px)" }}>
                <div ref={sealLRef} className="absolute inset-0 rounded-full bg-primary" style={{ clipPath: "inset(0 50% 0 0)" }} />
                <div ref={sealRRef} className="absolute inset-0 rounded-full bg-primary" style={{ clipPath: "inset(0 0 0 50%)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Controles sobre a cena — visíveis desde o primeiro quadro */}
        <div className="absolute right-3 top-3 flex gap-2">
          {phase === "scene" && (
            <Button ref={skipRef} size="sm" variant="secondary" onClick={skip} icon={<SkipForward aria-hidden className="size-4" />}>
              Pular
            </Button>
          )}
          {phase !== "scene" && (
            <Button size="sm" variant="ghost" onClick={play} icon={<RotateCcw aria-hidden className="size-4" />}>
              Rever cena
            </Button>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
          {phase !== "running" ? (
            <Button ref={startRef} onClick={start} loading={exam?.starting} icon={<Play aria-hidden className="size-4" />}>
              Começar prova
            </Button>
          ) : (
            <p className="rounded-control bg-surface px-3 py-2 t-meta text-ink">Prova em curso. A primeira questão abriria aqui.</p>
          )}
        </div>
      </div>
      <p className="mt-3 t-meta tabular text-ink-2" aria-live="polite">
        {log || (reduced ? "Movimento reduzido: capa final exibida direto, sem a cena." : "Esc ou Pular levam à capa final. O cronômetro só inicia em Começar prova.")}
      </p>
    </div>
  );
}
