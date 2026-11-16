"use client";

import { clsx } from "clsx";
import { gsap } from "gsap";
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { bezierFn, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";

/** Capa por cor de caderno. Cor sem par de tinta conferido usa papel e tinta. */
const COVERS: Record<string, { cover: string; sub: string }> = {
  Azul: { cover: "bg-primary text-on-primary", sub: "text-on-primary/80" },
  Amarelo: { cover: "bg-mark-yellow text-on-mark", sub: "text-on-mark/75" },
  Rosa: { cover: "bg-mark-pink text-on-mark", sub: "text-on-mark/75" },
};
const PAPER = { cover: "bg-surface text-ink", sub: "text-ink-2" };
const DEMO = ["Azul", "Amarelo"] as const;

const PROVA_MS = 5.5 * 3600_000;
const stageEase = bezierFn(ease.stage);
const softEase = bezierFn(ease.layout);

function hms(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Abertura do caderno no Dia D: o envelope lacrado sobre a mesa. O lacre rompe, a aba levanta, o caderno
 * sai e o envelope é puxado para fora; fica a capa, pronta para começar.
 *
 * A cena é plana, vista de cima, com as peças em camadas fixas (fundo do envelope com a aba aberta, caderno,
 * bolso da frente, aba fechada, lacre). Nenhuma peça gira em profundidade: a aba "dobra" encolhendo até a
 * borda e reabrindo para cima já na camada de trás. Assim nada atravessa nada, em qualquer tamanho de tela.
 * Dura cerca de 3 s, pode ser pulada desde o primeiro quadro (botão ou Esc) e, com movimento reduzido,
 * mostra a capa direto. O relógio da prova só começa em "Começar prova".
 */
export function EnvelopeOpening({
  exam,
}: {
  exam?: { color: string; day: number; minutes: number; starting: boolean; onStart: () => void };
} = {}) {
  const reduced = useReduced();
  const [demoColor, setDemoColor] = useState<string>(DEMO[0]);
  const color = exam?.color ?? demoColor;
  const look = COVERS[color] ?? PAPER;
  const day = exam?.day ?? 1;
  const [phase, setPhase] = useState<"scene" | "ready" | "running">("scene");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const flapOpenRef = useRef<HTMLDivElement>(null);
  const sealLRef = useRef<HTMLDivElement>(null);
  const sealRRef = useRef<HTMLDivElement>(null);
  const bookletRef = useRef<HTMLDivElement>(null);

  const build = useCallback(() => {
    tl.current?.kill();
    const t = gsap.timeline({ paused: true, onComplete: () => setPhase((p) => (p === "scene" ? "ready" : p)) });
    const envelope = [envelopeRef.current, pocketRef.current];
    // Quadro inicial: envelope fechado e lacrado, levemente girado sobre a mesa.
    t.set(stageRef.current, { rotation: -3, y: 44 })
      .set(envelope, { yPercent: 0, opacity: 1 })
      .set(flapRef.current, { scaleY: 1, opacity: 1 })
      .set(flapOpenRef.current, { scaleY: 0 })
      .set([sealLRef.current, sealRRef.current], { x: 0, rotation: 0, opacity: 1 })
      .set(bookletRef.current, { yPercent: 0, scale: 1 });
    // 1. O lacre rompe ao meio.
    t.to(sealLRef.current, { x: -16, rotation: -9, opacity: 0, duration: 0.4, ease: softEase }, 0.25)
      .to(sealRRef.current, { x: 16, rotation: 9, opacity: 0, duration: 0.4, ease: softEase }, 0.25);
    // 2. A aba dobra: a de cima encolhe até a borda; a de trás abre para cima, atrás do caderno.
    t.to(flapRef.current, { scaleY: 0, duration: 0.24, ease: "power2.in" }, 0.62)
      .set(flapRef.current, { opacity: 0 }, 0.86)
      .to(flapOpenRef.current, { scaleY: 1, duration: 0.32, ease: softEase }, 0.86);
    // 3. O caderno sai pelo alto, entre o fundo e o bolso do envelope.
    t.to(bookletRef.current, { yPercent: -42, duration: 0.85, ease: stageEase }, 1.15);
    // 4. O envelope é puxado para baixo, para fora da mesa.
    t.to(envelope, { yPercent: 135, duration: 0.6, ease: stageEase }, 2.0).to(envelope, { opacity: 0, duration: 0.2 }, 2.4);
    // 5. A capa assenta no centro, alinhada.
    t.to(bookletRef.current, { yPercent: 0, scale: 1.1, duration: 0.6, ease: stageEase }, 2.55).to(
      stageRef.current,
      { rotation: 0, y: 0, duration: 0.6, ease: stageEase },
      2.55,
    );
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

  const replay = useCallback(() => {
    if (!exam) setDemoColor((c) => DEMO[(DEMO.indexOf(c as (typeof DEMO)[number]) + 1) % DEMO.length]!);
    setPhase("scene");
    setStartedAt(null);
    run();
  }, [exam, run]);

  useLayoutEffect(() => {
    run();
    return () => {
      tl.current?.kill();
    };
  }, [run]);

  const skip = useCallback(() => {
    tl.current?.progress(1);
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
          <span data-testid="prova-timer" className="t-metric">
            {hms(remaining)}
          </span>
          <span className="t-meta text-ink-2" aria-live="polite">
            {phase === "running" ? "em curso" : "não iniciado"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!exam && <DemoBadge>Caderno demonstrativo</DemoBadge>}
          {phase === "scene" ? (
            <Button ref={skipRef} size="sm" variant="secondary" onClick={skip} icon={<SkipForward aria-hidden className="size-4" />}>
              Pular
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={replay} icon={<RotateCcw aria-hidden className="size-4" />}>
              Rever cena
            </Button>
          )}
        </div>
      </div>

      {/* A mesa: tudo aqui é desenho; o texto para leitor de tela vem na frase abaixo. */}
      <div
        role="group"
        aria-label="Cena de abertura do caderno"
        className="relative h-[430px] overflow-hidden rounded-panel bg-desk sm:h-[520px]"
        style={{ backgroundImage: "radial-gradient(ellipse 70% 60% at 50% 28%, var(--rs-lamp), transparent 70%)" }}
      >
        <p className="sr-only" aria-live="polite">
          {phase === "scene" ? "Abrindo o envelope do caderno." : `Caderno ${color}, ${day}º dia. Pronto para começar.`}
        </p>
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <div ref={stageRef} className="relative aspect-[0.74] w-[min(54%,250px)]">
            {/* 1 · fundo do envelope e, presa a ele, a aba aberta: nasce na borda de cima e cresce para fora, atrás do caderno */}
            <div ref={envelopeRef} className="absolute inset-0 z-[1]">
              <div className="absolute inset-0 rounded-[5px] bg-surface-subtle shadow-sheet" />
              <div
                ref={flapOpenRef}
                className="absolute inset-x-0 bottom-full h-[36%] origin-bottom bg-surface-subtle"
                style={{ clipPath: "polygon(0 100%, 100% 100%, 50% 0)", filter: "brightness(0.93)" }}
              />
            </div>
            {/* 3 · caderno */}
            <div ref={bookletRef} className={clsx("absolute inset-x-[7%] bottom-[4%] top-[5%] z-[3] rounded-[5px] p-[9%] shadow-paper", look.cover)}>
              <div className="flex h-full flex-col">
                <p className={clsx("font-mono text-[9.5px] font-medium uppercase leading-tight tracking-[0.1em] sm:text-[10.5px]", look.sub)}>Caderno de questões</p>
                <p className="mt-2 font-display text-[clamp(28px,7vw,44px)] leading-none">{day}º dia</p>
                <p className="mt-1.5 text-[13px] font-medium">Caderno {color}</p>
                <div className="mt-auto flex items-end justify-between gap-2">
                  <span className={clsx("font-mono text-[9.5px] uppercase tracking-[0.1em]", look.sub)}>{exam ? "Enem · Dia D" : "Demonstração"}</span>
                  <span className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className={clsx("size-2.5 rounded-full border border-current", i === 1 && "bg-current")} />
                    ))}
                  </span>
                </div>
              </div>
            </div>
            {/* 4 · bolso da frente, com o recorte em V por onde o caderno aparece */}
            <div
              ref={pocketRef}
              className="absolute inset-0 z-[4] rounded-[5px] bg-surface"
              style={{ clipPath: "polygon(0 0, 50% 34%, 100% 0, 100% 100%, 0 100%)" }}
            >
              <span className="absolute inset-x-[12%] bottom-[10%] flex flex-col gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-2">Abrir somente com autorização</span>
                <span className="h-px bg-line-subtle" />
                <span className="h-px w-2/3 bg-line-subtle" />
              </span>
            </div>
            {/* 5 · aba fechada */}
            <div
              ref={flapRef}
              className="absolute inset-x-0 top-0 z-[5] h-[36%] origin-top bg-surface-subtle"
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
            />
            {/* 6 · lacre: fita em duas metades sobre a ponta da aba */}
            <div className="absolute left-1/2 top-[33%] z-[6] h-[7.5%] w-[52%] -translate-x-1/2 -translate-y-1/2">
              <div ref={sealLRef} className="absolute inset-y-0 left-0 grid w-1/2 place-items-center rounded-l-[2px] bg-ink">
                <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-background">Lac</span>
              </div>
              <div ref={sealRRef} className="absolute inset-y-0 right-0 grid w-1/2 place-items-center rounded-r-[2px] bg-ink">
                <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-background">re</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {phase !== "running" ? (
          <Button ref={startRef} onClick={start} loading={exam?.starting} icon={<Play aria-hidden className="size-4" />}>
            Começar prova
          </Button>
        ) : (
          <p className="t-ui text-ink">Prova em curso. A primeira questão abriria aqui.</p>
        )}
        <p className="t-meta text-ink-2">
          {reduced ? "Movimento reduzido: a capa aparece direto. " : "Esc ou Pular levam direto à capa. "}O relógio só começa em Começar prova.
        </p>
      </div>
    </div>
  );
}
