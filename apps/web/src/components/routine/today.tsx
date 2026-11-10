"use client";

import { clsx } from "clsx";
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  Check,
  Play,
  RotateCcw,
  Shuffle,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import {
  fmtClock,
  fmtDuration,
  KIND_LABEL,
  type StudyBlock,
} from "@/lib/demo/routine";
import type { IfThenPlan } from "@/lib/routine/goals";
import type { DayBlock, DayPlan } from "@/lib/routine/plan";
import {
  focusAction,
  generateDayPlan,
  type FocusState,
} from "@/lib/routine/plan-actions";
import { minuteInZone } from "@/lib/routine/schedule-types";
import type { StreakView } from "@/lib/routine/streak";
import { DayAgenda } from "./day-agenda";
import { activeMs, FocusView, type FocusClock } from "./focus-view";
import { KindIcon } from "./kind-icon";

type Transition = {
  duration: number;
  ease: readonly [number, number, number, number];
};

const toStudyBlock = (b: DayBlock): StudyBlock => ({
  id: b.id,
  kind: b.kind,
  title: b.title,
  detail: b.reason ?? "",
  start: b.start_minute,
  minutes: b.planned_minutes,
});

const clockFrom = (s: FocusState, startedAt: number): FocusClock => {
  const t = Date.now();
  return {
    startedAt,
    accumulatedMs: s.active_seconds * 1000,
    runningSince: s.running ? t : null,
  };
};

/** "2026-11-10" → "terça-feira, 10 de novembro" (sem depender do fuso da máquina). */
function longDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/**
 * Hoje: o plano real do dia (F4-T15) com a próxima atividade em destaque, foco ligado ao relógio do
 * servidor (F4-T17), agenda com remarcação (F4-T16), o que já foi feito e o plano se-então ativo.
 * Começar foco: o cartão se expande até virar a área de trabalho; concluir devolve o bloco ao histórico.
 */
export function Today({
  plan,
  ifThen,
  streak,
}: {
  plan: DayPlan;
  ifThen: IfThenPlan | null;
  streak: StreakView | null;
}) {
  const router = useRouter();
  const reduced = useReduced();
  const [nowMin, setNowMin] = useState(plan.nowMinute);
  const [skipped, setSkipped] = useState<string[]>([]);
  /** synced = falso enquanto o tempo de um bloco já em curso não chegou do servidor. */
  const [focus, setFocus] = useState<{
    id: string;
    clock: FocusClock;
    synced: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Concluídos nesta tela antes de o servidor responder (registro antes da animação). */
  const [localDone, setLocalDone] = useState<Record<string, number>>({});
  const [rescheduleReq, setRescheduleReq] = useState<{
    id: string;
    n: number;
  } | null>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    const tick = () => setNowMin(minuteInZone(new Date(), plan.timezone));
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, [plan.timezone]);

  const blocks = useMemo(
    () =>
      plan.blocks.map((b) =>
        localDone[b.id] !== undefined
          ? {
              ...b,
              status: "concluido",
              actual_minutes: b.actual_minutes ?? localDone[b.id]!,
            }
          : b,
      ),
    [plan.blocks, localDone],
  );
  const open = useMemo(
    () =>
      blocks
        .filter((b) => b.status === "planejado" || b.status === "em_curso")
        .sort((a, b) => {
          // Em curso primeiro; depois por horário.
          if (a.status !== b.status) return a.status === "em_curso" ? -1 : 1;
          return a.start_minute - b.start_minute;
        }),
    [blocks],
  );
  const ordered = useMemo(() => {
    const rest = open.filter((b) => !skipped.includes(b.id));
    return [...rest, ...open.filter((b) => skipped.includes(b.id))];
  }, [open, skipped]);
  const done = blocks.filter((b) => b.status === "concluido");
  const hero = ordered[0] ?? null;
  const later = ordered.slice(1);
  const plannedTotal = blocks
    .filter((b) => b.status !== "dispensado")
    .reduce((a, b) => a + b.planned_minutes, 0);
  const doneTotal = done.reduce(
    (a, b) => a + (b.actual_minutes ?? b.planned_minutes),
    0,
  );
  const made = plan.generatedAt !== null;
  const focusedBlock = focus
    ? (blocks.find((b) => b.id === focus.id) ?? null)
    : null;

  const T: Transition = {
    duration: reduced ? 0 : duration.evidence / 1000,
    ease: ease.layout,
  };

  /** Abre o foco já registrado: a ação vai ao servidor e a tela acompanha. */
  const startFocus = useCallback(
    async (id: string) => {
      if (focus || busy) return; // clique repetido não abre dois focos
      setError(null);
      const t = Date.now();
      const b = blocks.find((x) => x.id === id);
      const resuming = b?.status === "em_curso";
      setFocus({
        id,
        clock: {
          startedAt: t,
          accumulatedMs: 0,
          runningSince: resuming ? null : t,
        },
        synced: !resuming,
      });
      setBusy(true);
      const r = await focusAction({
        blockId: id,
        action: resuming ? "estado" : "comecar",
      }).catch(() => ({ ok: false as const, message: "Sem conexão." }));
      // Bloco em curso, mas pausado: retomar ao abrir.
      const r2 =
        r.ok && !r.state.running && r.state.status !== "concluido"
          ? await focusAction({ blockId: id, action: "comecar" }).catch(
              () => r,
            )
          : r;
      setBusy(false);
      if (!r2.ok) {
        setFocus(null);
        setError(r2.message);
        return;
      }
      setFocus({ id, clock: clockFrom(r2.state, t), synced: true });
    },
    [focus, busy, blocks],
  );

  const togglePause = useCallback(async () => {
    if (!focus || busy) return;
    const running = focus.clock.runningSince !== null;
    const t = Date.now();
    const prev = focus;
    // Registra o novo estado na tela e confirma no servidor.
    setFocus({
      ...focus,
      clock: running
        ? {
            ...focus.clock,
            accumulatedMs: activeMs(focus.clock, t),
            runningSince: null,
          }
        : { ...focus.clock, runningSince: t },
    });
    setBusy(true);
    const r = await focusAction({
      blockId: focus.id,
      action: running ? "pausar" : "comecar",
    }).catch(() => ({ ok: false as const, message: "Sem conexão." }));
    setBusy(false);
    if (!r.ok) {
      setFocus(prev);
      setError(r.message);
      return;
    }
    setError(null);
    setFocus((f) =>
      f && f.id === prev.id
        ? { ...f, clock: clockFrom(r.state, f.clock.startedAt) }
        : f,
    );
  }, [focus, busy]);

  const conclude = useCallback(async () => {
    if (!focus || busy) return;
    setBusy(true);
    const r = await focusAction({ blockId: focus.id, action: "concluir" }).catch(
      () => ({ ok: false as const, message: "Sem conexão." }),
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    setLocalDone((d) => ({
      ...d,
      [focus.id]: Math.max(1, Math.round(r.state.active_seconds / 60)),
    }));
    setFocus(null);
    returnFocus.current = true;
    router.refresh();
  }, [focus, busy, router]);

  /** Volta para Hoje sem encerrar: o tempo continua contando no servidor. */
  const minimize = useCallback(() => {
    setFocus(null);
    setError(null);
    returnFocus.current = true;
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (focus || !returnFocus.current) return;
    returnFocus.current = false;
    const id = window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>("[data-hero-start]")
          ?.focus({ preventScroll: true }),
      30,
    );
    return () => window.clearTimeout(id);
  }, [focus]);

  const summary =
    plannedTotal > 0
      ? `${fmtDuration(plannedTotal)} planejados${doneTotal ? ` · ${fmtDuration(doneTotal)} feitos` : ""}`
      : null;

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
        <ScreenHeader title="Hoje" kicker={longDate(plan.today)}>
          {streak && <StreakChip s={streak} />}
        </ScreenHeader>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-10">
            <section aria-labelledby="plano-hoje" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="plano-hoje" className="t-kicker">
                  Plano de hoje
                </h2>
                {summary && (
                  <p className="t-meta tabular text-ink-2">{summary}</p>
                )}
              </div>

              {hero ? (
                focus?.id === hero.id ? (
                  <div
                    className="h-[260px] rounded-card border border-dashed border-line-subtle"
                    aria-hidden="true"
                  />
                ) : (
                  <HeroCard
                    key={hero.id}
                    block={hero}
                    nowMin={nowMin}
                    T={T}
                    busy={busy}
                    onStart={() => void startFocus(hero.id)}
                    onReschedule={() =>
                      setRescheduleReq({ id: hero.id, n: Date.now() })
                    }
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
                <EmptyDay
                  made={made}
                  hasAvailability={plan.available.length > 0}
                  allDone={done.length > 0}
                />
              )}

              <div aria-live="assertive">
                {error && !focus && (
                  <p role="alert" className="t-ui">
                    {error}
                  </p>
                )}
              </div>

              {later.length > 0 && (
                <div>
                  <h3 className="mb-1 t-meta font-medium text-ink-2">Depois</h3>
                  <ol className="relative">
                    {later.map((b) =>
                      focus?.id === b.id ? (
                        <li key={b.id} className="h-16" aria-hidden="true" />
                      ) : (
                        <li key={b.id}>
                          <LaterRow
                            block={b}
                            T={T}
                            onStart={() => void startFocus(b.id)}
                          />
                        </li>
                      ),
                    )}
                  </ol>
                </div>
              )}

              {plan.leftOut.length > 0 && (
                <div className="rounded-card bg-surface-subtle px-4 py-3">
                  <h3 className="t-meta font-medium text-ink">
                    Ficou de fora
                  </h3>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {plan.leftOut.map((l, i) => (
                      <li key={i} className="t-meta text-ink-2">
                        {"note" in l
                          ? l.note
                          : `${l.title} (${fmtDuration(l.minutes)}): ${l.why}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(made || plan.available.length > 0) && (
                <PlanButton made={made} />
              )}
            </section>

            {done.length > 0 && (
              <section aria-labelledby="feitos" className="flex flex-col gap-3">
                <h2 id="feitos" className="t-kicker">
                  Feito hoje
                </h2>
                <ul className="flex flex-col">
                  {done.map((b) => (
                    <li key={b.id}>
                      <motion.div
                        layoutId={`card-${b.id}`}
                        transition={T}
                        style={{ borderRadius: 12 }}
                        className="flex items-center gap-3 border-b border-line-subtle py-3"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-background">
                          <Check
                            aria-hidden="true"
                            className="size-4"
                            strokeWidth={2.5}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <motion.p
                            layoutId={`title-${b.id}`}
                            transition={T}
                            className="truncate t-ui"
                          >
                            {b.title}
                          </motion.p>
                          <p className="t-meta tabular text-ink-2">
                            {b.actual_minutes === null
                              ? "Concluído"
                              : b.actual_minutes < 1
                                ? "Menos de 1 min registrado"
                                : `${fmtDuration(b.actual_minutes)} registrados`}{" "}
                            · plano {fmtDuration(b.planned_minutes)}
                          </p>
                        </div>
                      </motion.div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <IfThenNote plan={ifThen} />
          </div>

          <aside className="flex min-w-0 flex-col gap-6" aria-label="Agenda">
            {plan.blocks.length > 0 ? (
              <DayAgenda plan={plan} openRequest={rescheduleReq} />
            ) : (
              <TodayWindows plan={plan} />
            )}
          </aside>
        </div>
      </motion.div>

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
            block={toStudyBlock(focusedBlock)}
            clock={focus.clock}
            synced={focus.synced}
            busy={busy}
            error={error}
            onTogglePause={() => void togglePause()}
            onEnd={() => void conclude()}
            onMinimize={minimize}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function StreakChip({ s }: { s: StreakView }) {
  const week = s.lastDays.slice(-7);
  return (
    <Link
      href="/rotina#sequencia"
      className="group flex items-center gap-3 rounded-full border border-line-subtle bg-surface py-1.5 pl-3 pr-4 hover:border-line"
    >
      <span className="flex gap-1" aria-hidden="true">
        {week.map((d) => (
          <span
            key={d.day}
            className={clsx(
              "size-2.5 rounded-full",
              d.active
                ? "bg-ink"
                : d.rest
                  ? "border border-ink"
                  : "border border-line",
            )}
          />
        ))}
      </span>
      <span className="t-meta text-ink">
        Sequência{" "}
        <span className="font-medium tabular">
          {s.streak} {s.streak === 1 ? "dia" : "dias"}
        </span>
      </span>
    </Link>
  );
}

function HeroCard({
  block,
  nowMin,
  T,
  busy,
  onStart,
  onReschedule,
  onSwap,
}: {
  block: DayBlock;
  nowMin: number;
  T: Transition;
  busy: boolean;
  onStart: () => void;
  onReschedule: () => void;
  onSwap?: () => void;
}) {
  const end = block.start_minute + block.planned_minutes;
  const running = block.status === "em_curso";
  const late = !running && end <= nowMin;
  const now = !running && !late && block.start_minute <= nowMin;
  const label = running
    ? "Em curso"
    : late
      ? "Passou do horário"
      : now
        ? "Agora"
        : `Começa em ${fmtDuration(block.start_minute - nowMin)}`;
  return (
    <motion.article
      layoutId={`card-${block.id}`}
      transition={T}
      style={{ borderRadius: 12 }}
      className="relative overflow-hidden border border-line bg-surface shadow-paper"
      aria-labelledby={`hero-${block.id}`}
    >
      <motion.span
        layoutId={`stripe-${block.id}`}
        transition={T}
        aria-hidden="true"
        className="absolute inset-y-0 left-5 w-0.5 bg-primary sm:left-8"
      />
      <div className="py-5 pl-10 pr-5 sm:py-7 sm:pl-14 sm:pr-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={clsx(
              "rounded-full px-2.5 py-0.5 t-meta font-medium",
              running || now
                ? "bg-mark-yellow text-on-mark"
                : "bg-surface-subtle text-ink",
            )}
          >
            {label}
          </span>
          <span className="inline-flex items-center gap-1.5 t-meta text-ink-2">
            <KindIcon kind={block.kind} className="size-3.5" />
            {KIND_LABEL[block.kind]}
          </span>
        </div>
        <p className="mt-5 font-display text-[40px] leading-none tabular text-ink sm:text-[52px]">
          {fmtClock(block.start_minute)}
          <span className="text-ink-2">–{fmtClock(end)}</span>
        </p>
        <motion.h3
          id={`hero-${block.id}`}
          layoutId={`title-${block.id}`}
          transition={T}
          className="mt-3 t-section text-ink"
        >
          {block.title}
        </motion.h3>
        <motion.p
          layoutId={`dur-${block.id}`}
          transition={T}
          className="mt-1 t-meta tabular text-ink-2"
        >
          {fmtDuration(block.planned_minutes)}
        </motion.p>
        {block.reason && (
          <p className="mt-4 flex max-w-xl gap-2 t-meta text-ink-2">
            <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="sr-only">Motivo: </span>
              {block.reason}
            </span>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            data-hero-start
            onClick={onStart}
            disabled={busy}
            icon={<Play aria-hidden className="size-4" />}
          >
            {running ? "Continuar foco" : "Começar foco"}
          </Button>
          {!running && (
            <Button
              variant="secondary"
              onClick={onReschedule}
              icon={<CalendarClock aria-hidden className="size-4" />}
            >
              Remarcar
            </Button>
          )}
          {onSwap && (
            <Button
              variant="ghost"
              onClick={onSwap}
              icon={<Shuffle aria-hidden className="size-4" />}
            >
              Outra atividade
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function LaterRow({
  block,
  T,
  onStart,
}: {
  block: DayBlock;
  T: Transition;
  onStart: () => void;
}) {
  return (
    <motion.div
      layoutId={`card-${block.id}`}
      transition={T}
      style={{ borderRadius: 12 }}
      className="relative flex min-h-16 items-center gap-4 border-b border-line-subtle py-2"
    >
      <motion.span
        layoutId={`stripe-${block.id}`}
        transition={T}
        aria-hidden="true"
        className="absolute inset-y-3 left-[3.25rem] w-px bg-line-subtle"
      />
      <span className="w-11 shrink-0 t-ui tabular text-ink">
        {fmtClock(block.start_minute)}
      </span>
      <div className="min-w-0 flex-1 pl-2">
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
            {fmtDuration(block.planned_minutes)}
          </motion.span>
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onStart}
        aria-label={`Começar foco: ${block.title}`}
        className="shrink-0"
      >
        Começar
      </Button>
    </motion.div>
  );
}

function EmptyDay({
  made,
  hasAvailability,
  allDone,
}: {
  made: boolean;
  hasAvailability: boolean;
  allDone: boolean;
}) {
  if (allDone)
    return (
      <div className="rounded-card border border-line-subtle bg-surface px-6 py-8 sm:px-8">
        <p className="font-display text-[32px] leading-tight text-ink">
          Plano de hoje concluído.
        </p>
        <p className="mt-2 max-w-lg t-reading text-ink-2">
          Se sobrar tempo, uma revisão curta mantém a fila em dia.
        </p>
        <Link
          href="/revisar"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 t-ui hover:bg-surface-subtle"
        >
          <RotateCcw aria-hidden className="size-4" /> Revisar
        </Link>
      </div>
    );
  if (!hasAvailability)
    return (
      <div className="rounded-card border border-line-subtle bg-surface px-6 py-8 sm:px-8">
        <p className="font-display text-[32px] leading-tight text-ink">
          Quando você pode estudar?
        </p>
        <p className="mt-2 max-w-lg t-reading text-ink-2">
          O plano do dia nasce dos seus horários livres. Marque na Rotina os
          horários da semana e os compromissos fixos; depois o Resolve monta os
          blocos sem encostar neles.
        </p>
        <Link
          href="/rotina#semana"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
        >
          <CalendarRange aria-hidden className="size-4" /> Definir horários
        </Link>
      </div>
    );
  return (
    <div className="rounded-card border border-line-subtle bg-surface px-6 py-8 sm:px-8">
      <p className="font-display text-[32px] leading-tight text-ink">
        {made ? "Nenhum bloco coube hoje." : "O dia ainda não tem plano."}
      </p>
      <p className="mt-2 max-w-lg t-reading text-ink-2">
        {made
          ? "Veja abaixo o motivo. Mudar um horário livre ou uma meta e refazer o plano costuma resolver."
          : "O plano usa seus horários livres a partir de agora: revisão vencida primeiro, depois as metas. Blocos de até 50 min com 5 min entre eles."}
      </p>
    </div>
  );
}

function PlanButton({ made }: { made: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size={made ? "sm" : "md"}
        variant={made ? "ghost" : "primary"}
        loading={pending}
        icon={made ? <RotateCcw aria-hidden className="size-4" /> : undefined}
        onClick={() =>
          start(async () => {
            const r = await generateDayPlan();
            setMsg(
              r.ok
                ? { ok: true, text: "Plano montado." }
                : { ok: false, text: r.message },
            );
            if (r.ok) router.refresh();
          })
        }
      >
        {made ? "Refazer plano de hoje" : "Montar plano de hoje"}
      </Button>
      <div aria-live="polite">
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="t-meta text-ink">
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function IfThenNote({ plan }: { plan: IfThenPlan | null }) {
  return (
    <section
      aria-labelledby="se-entao"
      className="border-l-2 border-line pl-4"
    >
      <h2 id="se-entao" className="t-meta font-medium text-ink-2">
        Se o dia apertar
      </h2>
      {plan ? (
        <p className="mt-1 font-display text-[20px] leading-snug text-ink">
          {plan.trigger_text}, então {plan.alternative_activity}{" "}
          <span className="font-sans t-meta tabular text-ink-2">
            ({fmtDuration(plan.duration_minutes)})
          </span>
        </p>
      ) : (
        <p className="mt-1 t-meta text-ink-2">
          Nenhum plano se-então ativo.{" "}
          <Link href="/rotina#planos" className="text-link underline">
            Criar um para dias difíceis
          </Link>
        </p>
      )}
    </section>
  );
}

/** Sem plano: o que há hoje na agenda (horários livres e compromissos). */
function TodayWindows({ plan }: { plan: DayPlan }) {
  const items = [
    ...plan.available.map((w) => ({ ...w, title: "Horário livre", free: true })),
    ...plan.commitments.map((c) => ({ ...c, free: false })),
  ].sort((a, b) => a.start - b.start);
  return (
    <section
      aria-labelledby="agenda-title"
      className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5"
    >
      <h2 id="agenda-title" className="t-section">
        Agenda de hoje
      </h2>
      {items.length ? (
        <ul className="mt-3 flex flex-col">
          {items.map((w, i) => (
            <li
              key={i}
              className="flex items-baseline gap-3 border-b border-line-subtle py-2 last:border-0"
            >
              <span className="w-24 shrink-0 t-meta tabular text-ink-2">
                {fmtClock(w.start)}–{fmtClock(w.end)}
              </span>
              <span className={clsx("t-ui", w.free ? "text-ink" : "text-ink-2")}>
                {w.title}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 t-meta text-ink-2">
          Nada marcado para hoje.{" "}
          <Link href="/rotina#semana" className="text-link underline">
            Abrir a Rotina
          </Link>
        </p>
      )}
    </section>
  );
}
