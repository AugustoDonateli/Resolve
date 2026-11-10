"use client";

import { clsx } from "clsx";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Lightbulb,
  Play,
  Shuffle,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import {
  canPlace,
  demoDay,
  fmtClock,
  fmtDuration,
  KIND_LABEL,
  minutesNow,
  type DoneEntry,
  type StudyBlock,
} from "@/lib/demo/routine";
import { Agenda } from "./agenda";
import { activeMs, FocusView, type FocusClock } from "./focus-view";
import { KindIcon } from "./kind-icon";
import { RescheduleDialog } from "./reschedule-dialog";

interface DayState {
  blocks: StudyBlock[];
  done: DoneEntry[];
  gridStart: number;
  gridEnd: number;
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function fmtActive(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return fmtDuration(Math.round(s / 60));
}

/**
 * Hoje (T03) — protótipo F1-T07 + coreografia F1-T17.
 * Hoje → Começar foco: o bloco escolhido é a origem e se expande até a área de
 * trabalho, levando título e duração; a agenda recua. Encerrar: o cartão se
 * recolhe para o lugar correspondente no histórico do dia, com hora e duração reais.
 */
export function Today() {
  const reduced = useReduced();
  const [day, setDay] = useState<DayState | null>(null);
  const [nowMin, setNowMin] = useState(0);
  const [focus, setFocus] = useState<{ id: string; clock: FocusClock } | null>(
    null,
  );
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const returnFocusTo = useRef<string | null>(null);

  useEffect(() => {
    // Agenda demonstrativa gerada a partir do relógio do aparelho (somente no cliente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDay(demoDay());
    setNowMin(minutesNow());
    const t = window.setInterval(() => setNowMin(minutesNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const doneIds = useMemo(() => new Set(day?.done.map((d) => d.id)), [day]);
  const upcoming = useMemo(
    () =>
      day
        ? day.blocks
            .filter((b) => !b.fixed && !doneIds.has(b.id))
            .sort((a, b) => a.start - b.start)
        : [],
    [day, doneIds],
  );
  const ordered = useMemo(() => {
    const rest = upcoming.filter((b) => !skipped.includes(b.id));
    return [...rest, ...upcoming.filter((b) => skipped.includes(b.id))];
  }, [upcoming, skipped]);
  const hero = ordered[0] ?? null;
  const later = ordered.slice(1);
  const focusedBlock =
    focus && day ? (day.blocks.find((b) => b.id === focus.id) ?? null) : null;

  const start = useCallback(
    (id: string) => {
      if (focus) return; // clique repetido não abre dois focos
      const t = Date.now();
      setFocus({
        id,
        clock: { startedAt: t, accumulatedMs: 0, runningSince: t },
      });
    },
    [focus],
  );

  const togglePause = useCallback(() => {
    setFocus((f) => {
      if (!f) return f;
      const t = Date.now();
      const c = f.clock;
      return {
        ...f,
        clock:
          c.runningSince === null
            ? { ...c, runningSince: t }
            : { ...c, accumulatedMs: activeMs(c, t), runningSince: null },
      };
    });
  }, []);

  const end = useCallback(() => {
    if (!focus || !day) return;
    const b = day.blocks.find((x) => x.id === focus.id);
    if (!b) return;
    const t = Date.now();
    // A conclusão é registrada imediatamente; a animação apenas a acompanha.
    const entry: DoneEntry = {
      id: b.id,
      kind: b.kind,
      title: b.title,
      startedAt: focus.clock.startedAt,
      endedAt: t,
      plannedMinutes: b.minutes,
      activeMs: activeMs(focus.clock, t),
    };
    setDay({ ...day, done: [entry, ...day.done] });
    setFocus(null);
    returnFocusTo.current = "hero";
  }, [focus, day]);

  // Depois do encerramento, o próximo bloco fica acessível pelo teclado.
  useEffect(() => {
    if (focus || returnFocusTo.current !== "hero") return;
    returnFocusTo.current = null;
    const id = window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>("[data-hero-start]")
          ?.focus({ preventScroll: true }),
      30,
    );
    return () => window.clearTimeout(id);
  }, [focus]);

  const reschedule = useCallback(
    (id: string, s: number) => {
      if (!day) return { ok: false as const, reason: "Agenda indisponível." };
      const r = canPlace(day.blocks, id, s, day.gridStart, day.gridEnd);
      if (r.ok)
        setDay({
          ...day,
          blocks: day.blocks.map((b) => (b.id === id ? { ...b, start: s } : b)),
        });
      return r;
    },
    [day],
  );

  const T = {
    duration: reduced ? 0 : duration.evidence / 1000,
    ease: ease.layout,
  };

  if (!day) return <TodaySkeleton />;

  return (
    <LayoutGroup>
      <motion.div
        inert={focus !== null}
        animate={{
          opacity: focus ? 0.5 : 1,
          scale: focus && !reduced ? 0.985 : 1,
        }}
        transition={{
          duration: reduced ? 0 : duration.layout / 1000,
          ease: ease.state,
        }}
        style={{ transformOrigin: "50% 0%" }}
      >
        <ScreenHeader
          title="Hoje"
          kicker={new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date())}
        >
          <DemoBadge>Dados demonstrativos</DemoBadge>
        </ScreenHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Próximo bloco */}
            <section aria-labelledby="next-title">
              <h2
                id="next-title"
                className="mb-3 t-meta font-medium uppercase tracking-[0.08em] text-ink-2"
              >
                Próximo bloco
              </h2>
              {hero ? (
                focus?.id === hero.id ? (
                  <div
                    className="h-[244px] rounded-card border border-dashed border-line-subtle"
                    aria-hidden="true"
                  />
                ) : (
                  <HeroCard
                    key={hero.id}
                    block={hero}
                    T={T}
                    onStart={() => start(hero.id)}
                    onReschedule={() => setRescheduleId(hero.id)}
                    onSwap={
                      later.length
                        ? () =>
                            setSkipped((s) => [
                              ...s.filter((x) => x !== hero.id),
                              hero.id,
                            ])
                        : undefined
                    }
                  />
                )
              ) : (
                <div className="rounded-card border border-line-subtle bg-surface p-6">
                  <p className="t-section">Plano de hoje concluído.</p>
                  <p className="mt-1 t-reading text-ink-2">
                    Se sobrar tempo, uma revisão curta mantém a fila em dia.
                  </p>
                </div>
              )}
            </section>

            {later.length > 0 && (
              <section aria-labelledby="later-title">
                <h2
                  id="later-title"
                  className="mb-3 t-meta font-medium uppercase tracking-[0.08em] text-ink-2"
                >
                  Depois
                </h2>
                <ul className="flex flex-col gap-2">
                  {later.map((b) =>
                    focus?.id === b.id ? (
                      <li
                        key={b.id}
                        className="h-[68px] rounded-card border border-dashed border-line-subtle"
                        aria-hidden="true"
                      />
                    ) : (
                      <li key={b.id}>
                        <LaterRow block={b} T={T} onStart={() => start(b.id)} />
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}

            <section
              aria-labelledby="plan-b"
              className="flex gap-3 rounded-card border border-line-subtle bg-surface-subtle p-4"
            >
              <Lightbulb
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink"
              />
              <div>
                <h2 id="plan-b" className="t-ui">
                  Plano se-então
                </h2>
                <p className="t-meta text-ink-2">
                  Se eu chegar cansado, então faço 10 minutos de revisão e
                  encerro sem culpa.
                </p>
              </div>
            </section>

            <section aria-labelledby="done-title">
              <h2
                id="done-title"
                className="mb-3 t-meta font-medium uppercase tracking-[0.08em] text-ink-2"
              >
                Concluídos hoje
              </h2>
              <ul className="flex flex-col gap-2">
                {day.done.map((d) => (
                  <li key={d.id}>
                    <motion.div
                      layoutId={`card-${d.id}`}
                      transition={T}
                      style={{ borderRadius: 12 }}
                      className="relative flex items-center gap-3 overflow-hidden border border-line-subtle bg-surface py-3 pl-4 pr-4"
                    >
                      <motion.span
                        layoutId={`stripe-${d.id}`}
                        transition={T}
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 bg-line-subtle"
                      />
                      <motion.span
                        layout="position"
                        transition={T}
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-background"
                      >
                        <Check
                          aria-hidden="true"
                          className="size-4"
                          strokeWidth={2.5}
                        />
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <motion.p
                          layoutId={`title-${d.id}`}
                          transition={T}
                          className="truncate t-ui"
                        >
                          {d.title}
                        </motion.p>
                        <motion.p
                          layout="position"
                          transition={T}
                          className="t-meta tabular text-ink-2"
                        >
                          {timeFmt.format(d.startedAt)}–
                          {timeFmt.format(d.endedAt)} · {fmtActive(d.activeMs)}{" "}
                          registrados
                        </motion.p>
                      </div>
                      <motion.span
                        layoutId={`dur-${d.id}`}
                        transition={T}
                        className="hidden shrink-0 rounded-full bg-surface-subtle px-2.5 py-0.5 t-meta tabular text-ink-2 sm:inline-flex"
                      >
                        plano {fmtDuration(d.plannedMinutes)}
                      </motion.span>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <Agenda
            blocks={day.blocks.filter((b) => !doneIds.has(b.id))}
            gridStart={day.gridStart}
            gridEnd={day.gridEnd}
            nowMin={nowMin}
            focusedId={focus?.id ?? null}
            onReschedule={reschedule}
            onOpenReschedule={setRescheduleId}
          />
        </div>
      </motion.div>

      {/* Fundo de foco: a agenda recua enquanto o cartão vira área de trabalho. */}
      <AnimatePresence>
        {focus && (
          <motion.div
            key="focus-backdrop"
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: {
                duration: reduced ? 0 : duration.layout / 1000,
                delay: reduced ? 0 : 0.12,
              },
            }}
            transition={{
              duration: reduced ? 0 : duration.layout / 1000,
              ease: ease.state,
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {focus && focusedBlock && (
          <FocusView
            key={focus.id}
            block={focusedBlock}
            clock={focus.clock}
            onTogglePause={togglePause}
            onEnd={end}
          />
        )}
      </AnimatePresence>

      <RescheduleDialog
        block={
          rescheduleId
            ? (day.blocks.find((b) => b.id === rescheduleId) ?? null)
            : null
        }
        blocks={day.blocks}
        gridStart={day.gridStart}
        gridEnd={day.gridEnd}
        onClose={() => setRescheduleId(null)}
        onConfirm={(id, s) => {
          reschedule(id, s);
          setRescheduleId(null);
        }}
      />
    </LayoutGroup>
  );
}

type Transition = {
  duration: number;
  ease: readonly [number, number, number, number];
};

function HeroCard({
  block,
  T,
  onStart,
  onReschedule,
  onSwap,
}: {
  block: StudyBlock;
  T: Transition;
  onStart: () => void;
  onReschedule: () => void;
  onSwap?: () => void;
}) {
  return (
    <motion.article
      layoutId={`card-${block.id}`}
      transition={T}
      style={{ borderRadius: 12 }}
      className="relative overflow-hidden border border-line bg-surface p-5 pl-7 shadow-paper sm:p-6 sm:pl-8"
      aria-labelledby={`hero-${block.id}`}
    >
      <motion.span
        layoutId={`stripe-${block.id}`}
        transition={T}
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-primary"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 t-meta text-ink-2">
          <KindIcon kind={block.kind} />
          {KIND_LABEL[block.kind]}
        </span>
        <span className="t-meta tabular text-ink-2">
          {fmtClock(block.start)}–{fmtClock(block.start + block.minutes)}
        </span>
      </div>
      <motion.h3
        id={`hero-${block.id}`}
        layoutId={`title-${block.id}`}
        transition={T}
        className="mt-3 t-section text-ink"
      >
        {block.title}
      </motion.h3>
      <p className="mt-1 t-reading text-ink-2">{block.detail}</p>
      <motion.span
        layoutId={`dur-${block.id}`}
        transition={T}
        className="mt-3 inline-flex rounded-full bg-surface-subtle px-2.5 py-0.5 t-meta tabular text-ink"
      >
        {fmtDuration(block.minutes)}
      </motion.span>
      {block.reason && (
        <p className="mt-4 flex gap-2 border-t border-line-subtle pt-4 t-meta text-ink-2">
          <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="sr-only">Motivo: </span>
            {block.reason}
          </span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          data-hero-start
          onClick={onStart}
          icon={<Play aria-hidden className="size-4" />}
        >
          Começar
        </Button>
        <Button
          variant="secondary"
          onClick={onReschedule}
          icon={<CalendarClock aria-hidden className="size-4" />}
        >
          Remarcar
        </Button>
        {onSwap && (
          <Button
            variant="ghost"
            onClick={onSwap}
            icon={<Shuffle aria-hidden className="size-4" />}
          >
            Trocar atividade
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function LaterRow({
  block,
  T,
  onStart,
}: {
  block: StudyBlock;
  T: Transition;
  onStart: () => void;
}) {
  return (
    <motion.div
      layoutId={`card-${block.id}`}
      transition={T}
      style={{ borderRadius: 12 }}
      className="relative flex min-h-[68px] items-center gap-3 overflow-hidden border border-line-subtle bg-surface py-2.5 pl-4 pr-2.5"
    >
      <motion.span
        layoutId={`stripe-${block.id}`}
        transition={T}
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-primary/60"
      />
      <span className="w-12 shrink-0 t-meta tabular text-ink-2">
        {fmtClock(block.start)}
      </span>
      <div className="min-w-0 flex-1">
        <motion.p
          layoutId={`title-${block.id}`}
          transition={T}
          className="truncate t-ui"
        >
          {block.title}
        </motion.p>
        <p className="flex items-center gap-1.5 truncate t-meta text-ink-2">
          <KindIcon kind={block.kind} className="size-3.5" />
          {KIND_LABEL[block.kind]} ·{" "}
          <motion.span
            layoutId={`dur-${block.id}`}
            transition={T}
            className="inline-block tabular"
          >
            {fmtDuration(block.minutes)}
          </motion.span>
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onStart}
        aria-label={`Começar ${block.title}`}
        className={clsx("shrink-0")}
      >
        Começar
      </Button>
    </motion.div>
  );
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando Hoje">
      <div className="mb-8 h-[66px]" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-8">
        <div className="flex flex-col gap-6">
          <div className="h-[280px] rounded-card bg-surface-subtle" />
          <div className="h-[150px] rounded-card bg-surface-subtle" />
        </div>
        <div className="h-[460px] rounded-panel bg-surface-subtle" />
      </div>
    </div>
  );
}
