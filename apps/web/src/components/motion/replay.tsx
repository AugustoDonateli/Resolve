"use client";

import { clsx } from "clsx";
import { Flag, Pause, Play, RotateCcw, SkipBack, SkipForward, Table2, Waypoints } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import {
  demoEvents as EVENTS,
  EVENT_LABEL,
  finalAnswers,
  gapBefore,
  minutesPerSecond,
  SESSION_MINUTES,
  type ReplayEvent,
} from "@/lib/demo/replay";

const LETTERS = ["A", "B", "C", "D", "E"] as const;
const QUESTIONS = Array.from(new Set(EVENTS.map((e) => e.q))).sort((a, b) => a - b);
const pct = (t: number) => `${(t / SESSION_MINUTES) * 100}%`;

/**
 * Replay (M06; protótipo F1-T12). O cartão-resposta vira linha do tempo: cada
 * bolinha marcada viaja até o evento que a produziu. O resumo percorre a
 * sessão em escala indicada; pausar, voltar e abrir um evento não alteram dados.
 */
export function Replay() {
  const reduced = useReduced();
  const [view, setView] = useState<"card" | "timeline">("card");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const finals = useMemo(() => finalAnswers(EVENTS), []);
  const sorted = useMemo(() => [...EVENTS].sort((a, b) => a.t - b.t), []);
  const raf = useRef<number | null>(null);

  // Reprodução: avança o cursor em tempo comprimido (1 s = 3 min).
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setCursor((c) => {
        const next = Math.min(SESSION_MINUTES, c + dt * minutesPerSecond);
        if (next >= SESSION_MINUTES) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  const toTimeline = () => setView("timeline");

  const playPause = () => {
    if (view === "card") {
      toTimeline();
      setCursor(0);
      // A reprodução começa depois da transformação do cartão.
      window.setTimeout(() => setPlaying(true), reduced ? 0 : 900);
      return;
    }
    if (cursor >= SESSION_MINUTES) setCursor(0);
    setPlaying((p) => !p);
  };

  const jump = useCallback(
    (dir: -1 | 1) => {
      setPlaying(false);
      const target = dir === 1 ? sorted.find((e) => e.t > cursor + 0.01) : [...sorted].reverse().find((e) => e.t < cursor - 0.01);
      if (target) {
        setCursor(target.t);
        setSelected(target.id);
      } else if (dir === -1) {
        setCursor(0);
        setSelected(null);
      }
    },
    [cursor, sorted],
  );

  const select = (e: ReplayEvent) => {
    setPlaying(false);
    setCursor(e.t);
    setSelected(e.id);
  };

  const sel = sorted.find((e) => e.id === selected) ?? null;
  const T = (i: number) => ({ duration: reduced ? 0 : 0.7, ease: ease.stage, delay: reduced ? 0 : i * 0.04 });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="t-meta text-ink-2">Sessão de 45 minutos · {QUESTIONS.length} questões · 10 eventos</p>
        <DemoBadge>Sessão demonstrativa</DemoBadge>
      </div>

      <LayoutGroup id="replay">
        <section aria-label={view === "card" ? "Cartão-resposta" : "Linha do tempo da sessão"} className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-6">
          {view === "card" ? (
            <ol className="mx-auto grid max-w-md gap-1.5">
              {QUESTIONS.map((q, qi) => {
                const f = finals.get(q);
                return (
                  <li key={q} className="flex items-center gap-3">
                    <span className="w-8 t-meta tabular text-ink-2">Q{q}</span>
                    <span className="flex gap-2" aria-label={f ? `Questão ${q}: ${f.letter}` : `Questão ${q}: em branco`}>
                      {LETTERS.map((L) =>
                        f?.letter === L ? (
                          <motion.span key={L} layoutId={`bubble-${q}`} transition={T(qi)} className="grid size-8 place-items-center rounded-full bg-ink t-meta font-medium text-background" aria-hidden="true">
                            {L}
                          </motion.span>
                        ) : (
                          <span key={L} aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-line t-meta text-ink-2">
                            {L}
                          </span>
                        ),
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Timeline cursor={cursor} selected={selected} finals={finals} onSelect={select} T={T} reduced={reduced} />
          )}
        </section>
      </LayoutGroup>

      {/* Controles */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!(reduced && view === "timeline") && (
          <Button onClick={playPause} icon={playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}>
            {view === "card" ? "Reproduzir resumo" : playing ? "Pausar" : cursor >= SESSION_MINUTES ? "Reproduzir de novo" : "Continuar"}
          </Button>
        )}
        {view === "card" && (
          <Button variant="secondary" onClick={toTimeline} icon={<Waypoints aria-hidden className="size-4" />}>
            Ver linha do tempo
          </Button>
        )}
        {view === "timeline" && (
          <>
            <Button variant="secondary" size="sm" onClick={() => jump(-1)} icon={<SkipBack aria-hidden className="size-4" />}>
              Evento anterior
            </Button>
            <Button variant="secondary" size="sm" onClick={() => jump(1)} icon={<SkipForward aria-hidden className="size-4" />}>
              Próximo evento
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPlaying(false);
                setCursor(0);
                setSelected(null);
                setView("card");
              }}
              icon={<RotateCcw aria-hidden className="size-4" />}
            >
              Voltar ao cartão
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)} aria-expanded={table} icon={<Table2 aria-hidden className="size-4" />}>
          {table ? "Ocultar tabela" : "Ver tabela"}
        </Button>
      </div>

      <p className="mt-3 t-meta tabular text-ink-2">
        Escala do resumo: 1 s = {minutesPerSecond} min de prova · posição {Math.floor(cursor)} de {SESSION_MINUTES} min
      </p>

      {sel && (
        <section aria-live="polite" aria-label="Evento selecionado" className="mt-4 rounded-card border border-ink bg-surface p-4">
          <p className="t-ui">
            Questão {sel.q} · {EVENT_LABEL[sel.type]}
          </p>
          <p className="mt-1 t-meta text-ink-2">
            Aos {sel.t} min{sel.type === "mudanca" ? `, de ${sel.from} para ${sel.letter}` : sel.letter ? `, alternativa ${sel.letter}` : ""}. {gapBefore(EVENTS, sel.id)} min desde o evento anterior — tempo entre registros, não medida de atenção.
          </p>
          <p className="mt-2 t-meta text-ink-2">Na versão real, “Abrir questão” leva à questão {sel.q} desta sessão. A explicação detalhada só abre por ação.</p>
        </section>
      )}

      {table && <EventTable />}
    </div>
  );
}

function Timeline({
  cursor,
  selected,
  finals,
  onSelect,
  T,
  reduced,
}: {
  cursor: number;
  selected: string | null;
  finals: Map<number, { letter: string; eventId: string }>;
  onSelect: (e: ReplayEvent) => void;
  T: (i: number) => object;
  reduced: boolean;
}) {
  const firstOf = (q: number) => EVENTS.filter((e) => e.q === q).sort((a, b) => a.t - b.t)[0]!;
  const fade = { duration: reduced ? 0 : duration.layout / 1000, delay: reduced ? 0 : 0.55 };
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="relative mx-8 min-w-[600px] pb-2 pt-16">
        {/* Arcos de retorno: do primeiro contato com a questão até o retorno */}
        <motion.svg aria-hidden="true" viewBox="0 0 100 64" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-16 w-full overflow-visible" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
          {EVENTS.filter((e) => e.type === "retorno" || e.type === "mudanca").map((e) => {
            const a = (firstOf(e.q).t / SESSION_MINUTES) * 100;
            const b = (e.t / SESSION_MINUTES) * 100;
            const lit = cursor >= e.t;
            return (
              <path
                key={e.id}
                d={`M ${b} 60 C ${b} 8, ${a} 8, ${a} 60`}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                className={clsx("text-ink transition-opacity duration-[var(--rs-dur-state)]", lit ? "opacity-70" : "opacity-15")}
              />
            );
          })}
        </motion.svg>

        {/* Trilho e marcas de tempo */}
        <motion.div className="relative h-px bg-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ transformOrigin: "0 50%" }} transition={{ duration: reduced ? 0 : 0.5, ease: ease.stage }}>
          {[0, 15, 30, 45].map((m) => (
            <span key={m} className="absolute top-[68px] -translate-x-1/2 whitespace-nowrap t-meta tabular text-ink-2" style={{ left: pct(m) }}>
              {m} min
            </span>
          ))}
          {[0, 15, 30, 45].map((m) => (
            <span key={`t${m}`} aria-hidden="true" className="absolute -top-1 h-2 w-px bg-line" style={{ left: pct(m) }} />
          ))}
        </motion.div>

        {/* Eventos */}
        <ol className="absolute inset-x-0 top-16 h-0">
          {EVENTS.map((e) => {
            const isFinal = finals.get(e.q)?.eventId === e.id;
            const lit = cursor >= e.t - 0.01;
            const qi = e.q - 1;
            const label = `${e.t} min, questão ${e.q}: ${EVENT_LABEL[e.type]}${e.type === "mudanca" ? ` de ${e.from} para ${e.letter}` : e.letter ? ` ${e.letter}` : ""}`;
            return (
              <li key={e.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pct(e.t) }}>
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  aria-pressed={selected === e.id}
                  className={clsx(
                    "relative grid place-items-center rounded-full transition-opacity duration-[var(--rs-dur-state)]",
                    lit ? "opacity-100" : "opacity-35",
                    selected === e.id && "ring-2 ring-ink ring-offset-4 ring-offset-surface",
                  )}
                >
                  {isFinal ? (
                    <motion.span layoutId={`bubble-${e.q}`} transition={T(qi)} className="grid size-8 place-items-center rounded-full bg-ink t-meta font-medium text-background">
                      {e.letter}
                    </motion.span>
                  ) : (
                    <motion.span initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={fade} className="relative grid size-8 place-items-center">
                      {e.type === "marcada" ? (
                        <span className="grid size-8 place-items-center rounded-full border-2 border-dashed border-ink text-ink">
                          <Flag aria-hidden="true" className="size-3.5" />
                        </span>
                      ) : (
                        <span className="grid size-8 place-items-center rounded-full border-2 border-ink t-meta text-ink">{e.letter}</span>
                      )}
                    </motion.span>
                  )}
                  {/* Nome = letras visíveis + descrição só para leitor de tela (WCAG 2.5.3). */}
                  <span className="sr-only">, {label}</span>
                  {e.type === "mudanca" && (
                    <span aria-hidden="true" className="absolute -left-3 -top-3 grid size-5 place-items-center rounded-full border border-ink bg-surface text-[11px] text-ink-2 line-through">
                      {e.from}
                    </span>
                  )}
                </button>
                <span aria-hidden="true" className="absolute left-1/2 top-11 -translate-x-1/2 t-meta tabular text-ink-2">
                  Q{e.q}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Cursor do resumo */}
        <div aria-hidden="true" className="pointer-events-none absolute top-10 h-[60px] w-0.5 -translate-x-1/2 bg-link" style={{ left: pct(cursor) }} />
        <div className="h-24" />
      </div>
    </div>
  );
}

function EventTable() {
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line-subtle bg-surface">
      <table className="w-full text-left t-meta">
        <caption className="sr-only">Eventos da sessão demonstrativa</caption>
        <thead className="border-b border-line-subtle text-ink-2">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Tempo</th>
            <th scope="col" className="px-4 py-2 font-medium">Questão</th>
            <th scope="col" className="px-4 py-2 font-medium">Evento</th>
            <th scope="col" className="px-4 py-2 font-medium">Alternativa</th>
          </tr>
        </thead>
        <tbody>
          {EVENTS.map((e) => (
            <tr key={e.id} className="border-b border-line-subtle last:border-0">
              <td className="px-4 py-2 tabular">{e.t} min</td>
              <td className="px-4 py-2 tabular">Q{e.q}</td>
              <td className="px-4 py-2">{EVENT_LABEL[e.type]}</td>
              <td className="px-4 py-2">{e.type === "mudanca" ? `${e.from} → ${e.letter}` : e.letter ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
