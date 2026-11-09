"use client";

import { clsx } from "clsx";
import { ArrowDown, ChevronLeft, ChevronRight, Database, Eye, ScanLine } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useMemo, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Alternatives } from "@/components/ui/alternatives";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { demoQuestion as Q, RAIOX_STEPS, type DemoNote, type Segment } from "@/lib/demo/question";
import { Mark } from "./mark";
import { MarginNotes } from "./margin-notes";

type Phase = "answering" | "confirmed" | "raiox";

const stepIndex = (id: DemoNote["step"]) => RAIOX_STEPS.findIndex((s) => s.id === id);

/**
 * Questão → Raio-X (T05/T06; protótipo F1-T18, parte Raio-X).
 * A marca da alternativa confirmada permanece como referência. O scanner (M01)
 * avança uma etapa por ação: comando → evidência → distratores → Brasil.
 * O texto não muda de lugar: no PC a margem já está reservada; no celular a
 * nota abre abaixo do parágrafo apenas quando o aluno pede (“Ir ao trecho”).
 */
export function QuestionRaioX() {
  const reduced = useReduced();
  const [value, setValue] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("answering");
  const [step, setStep] = useState(-1);
  const [inlineNote, setInlineNote] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement>(null);

  const correctKey = Q.alternatives.find((a) => a.correct)!.key;
  const confirmed = phase !== "answering";
  const activeNotes = useMemo(() => Q.notes.filter((n) => phase === "raiox" && stepIndex(n.step) <= step), [phase, step]);
  const activeAnchors = new Map(activeNotes.map((n) => [n.anchor, n] as const));
  const currentStep = RAIOX_STEPS[step];
  const currentNotes = Q.notes.filter((n) => currentStep && n.step === currentStep.id);

  const toggleEliminate = (key: string) =>
    setEliminated((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const goToAnchor = (anchor: string, noteId: string) => {
    const el = scopeRef.current?.querySelector(`[data-anchor="${anchor}"]`);
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    setInlineNote(noteId);
    setSelectedNote(noteId);
  };

  const renderSegments = (segs: Segment[], delayBase = 0) =>
    segs.map((s, i) => {
      const note = s.anchor ? activeAnchors.get(s.anchor) : undefined;
      if (!s.anchor) return <Fragment key={i}>{s.text}</Fragment>;
      return (
        <Mark
          key={i}
          anchor={s.anchor}
          on={!!note}
          color={note?.color ?? "yellow"}
          delay={delayBase}
          label={note ? `${note.title}: abrir anotação` : undefined}
          onActivate={note ? () => goToAnchor(s.anchor!, note.id) : undefined}
        >
          {s.text}
        </Mark>
      );
    });

  const inlineFor = (segs: Segment[]) => {
    const n = activeNotes.find((x) => x.id === inlineNote && segs.some((s) => s.anchor === x.anchor));
    return (
      <AnimatePresence initial={false}>
        {n && (
          <motion.div
            key={n.id}
            className="overflow-hidden md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : duration.layout / 1000, ease: ease.layout }}
          >
            <div className="mt-3 flex gap-3 rounded-card border border-line-subtle bg-surface-subtle p-3">
              <span aria-hidden="true" className={clsx("mt-1 w-1 shrink-0 self-stretch rounded-full", n.color === "yellow" ? "bg-mark-yellow" : "bg-mark-pink")} />
              <div>
                <p className="t-meta font-medium text-ink">{n.title}</p>
                <p className="t-meta text-ink-2">{n.body}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="t-meta font-medium uppercase tracking-[0.08em] text-ink-2">{Q.area}</span>
        <DemoBadge>Questão demonstrativa · não é item do ENEM</DemoBadge>
      </div>

      <div ref={scopeRef} className="grid gap-x-10 md:grid-cols-[minmax(0,68ch)_minmax(220px,280px)]">
        <div className="min-w-0">
          <article aria-labelledby="q-title" className="rounded-panel border border-line-subtle bg-surface p-5 sm:p-7">
            <h2 id="q-title" className="t-section">
              {Q.title}
            </h2>
            <div className="mt-4 flex flex-col gap-4 t-reading text-ink">
              {Q.paragraphs.map((p, i) => (
                <div key={i}>
                  <p>{renderSegments(p, 0.05)}</p>
                  {inlineFor(p)}
                </div>
              ))}
            </div>
            <p className="mt-5 t-meta text-ink-2">{Q.source}</p>
          </article>

          <div className="mt-6">
            <p id="q-command" className="t-reading font-medium text-ink">
              {renderSegments(Q.command)}
            </p>
            {inlineFor(Q.command)}
            <div className="mt-4">
              <Alternatives
                name="q1"
                labelledBy="q-command"
                items={Q.alternatives.map((a) => ({ key: a.key, letter: a.letter, content: a.text }))}
                value={value}
                onValueChange={setValue}
                eliminated={eliminated}
                onToggleEliminate={toggleEliminate}
                confirmed={confirmed}
                reveal={confirmed ? { correctKey } : null}
                aside={(key) => {
                  const alt = Q.alternatives.find((a) => a.key === key);
                  const show = phase === "raiox" && step >= 2 && alt?.distractor;
                  return (
                    <AnimatePresence>
                      {show && (
                        <motion.span
                          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : duration.state / 1000, ease: ease.state, delay: reduced ? 0 : 0.06 * "acde".indexOf(key) }}
                          className="hidden rounded-full bg-mark-pink px-2 py-0.5 text-[12px] font-medium leading-4 text-on-mark sm:inline-block"
                        >
                          {alt.distractor}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  );
                }}
              />
            </div>
          </div>

          {/* Barra de ação: resposta e scanner */}
          <div className="mt-6">
            {phase === "answering" && (
              <Button onClick={() => setPhase("confirmed")} disabled={!value}>
                Confirmar resposta
              </Button>
            )}
            {phase === "confirmed" && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="t-ui" aria-live="polite">
                  {value === correctKey ? "Você acertou." : "Resposta registrada. A alternativa correta está marcada."}
                </p>
                <Button
                  icon={<ScanLine aria-hidden className="size-4" />}
                  onClick={() => {
                    setPhase("raiox");
                    setStep(0);
                  }}
                >
                  Ver Raio-X
                </Button>
              </div>
            )}
            {phase === "raiox" && currentStep && (
              <ScannerPanel
                step={step}
                notes={currentNotes}
                onPrev={() => setStep((s) => Math.max(0, s - 1))}
                onNext={() => setStep((s) => Math.min(RAIOX_STEPS.length - 1, s + 1))}
                onAll={() => setStep(RAIOX_STEPS.length - 1)}
                onGo={goToAnchor}
              />
            )}
            {phase === "raiox" && step >= 2 && <DistractorList />}
          </div>
        </div>

        <MarginNotes
          className="hidden md:block"
          scopeRef={scopeRef}
          notes={activeNotes.map((n) => ({ id: n.id, anchor: n.anchor, color: n.color, title: n.title, body: n.body }))}
          selectedId={selectedNote}
          onSelect={setSelectedNote}
        />
      </div>
    </div>
  );
}

function ScannerPanel({
  step,
  notes,
  onPrev,
  onNext,
  onAll,
  onGo,
}: {
  step: number;
  notes: DemoNote[];
  onPrev: () => void;
  onNext: () => void;
  onAll: () => void;
  onGo: (anchor: string, noteId: string) => void;
}) {
  const s = RAIOX_STEPS[step]!;
  const last = step === RAIOX_STEPS.length - 1;
  return (
    <section aria-labelledby="scanner-title" className="rounded-panel border border-ink bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="scanner-title" className="flex items-center gap-2 t-ui">
          <ScanLine aria-hidden="true" className="size-4" />
          Raio-X · {s.label}
        </h3>
        <ol className="flex gap-1.5" aria-label={`Etapa ${step + 1} de ${RAIOX_STEPS.length}`}>
          {RAIOX_STEPS.map((x, i) => (
            <li key={x.id} aria-hidden="true" className={clsx("h-1.5 w-6 rounded-full", i <= step ? "bg-ink" : "bg-line-subtle")} />
          ))}
        </ol>
      </div>
      <div aria-live="polite" className="mt-3">
        {s.id === "brasil" ? (
          <div className="flex gap-3 rounded-card bg-surface-subtle p-3">
            <Database aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="t-ui">Distribuição no Brasil indisponível</p>
              <p className="t-meta text-ink-2">
                O percentual por alternativa vem dos microdados oficiais da edição. Esta questão é demonstrativa e não tem esses dados; nenhum número é estimado no lugar.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 t-meta">
                  <span className="font-medium text-ink">{n.title}. </span>
                  <span className="text-ink-2">{n.body}</span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => onGo(n.anchor, n.id)} icon={<ArrowDown aria-hidden className="size-4" />}>
                  Ir ao trecho
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onPrev} disabled={step === 0} icon={<ChevronLeft aria-hidden className="size-4" />}>
          Anterior
        </Button>
        {!last ? (
          <>
            <Button size="sm" onClick={onNext} icon={<ChevronRight aria-hidden className="size-4" />}>
              Próxima: {RAIOX_STEPS[step + 1]!.label}
            </Button>
            <Button size="sm" variant="ghost" onClick={onAll} icon={<Eye aria-hidden className="size-4" />}>
              Mostrar tudo
            </Button>
          </>
        ) : (
          <p className="self-center t-meta text-ink-2">Próximo passo: o erro entra no caderno e na revisão (F3-T06).</p>
        )}
      </div>
    </section>
  );
}

function DistractorList() {
  return (
    <section aria-labelledby="distr-title" className="mt-4 rounded-card border border-line-subtle bg-surface p-4">
      <h3 id="distr-title" className="mb-2 t-ui">
        Por que as outras não respondem
      </h3>
      <ul className="flex flex-col gap-2">
        {Q.alternatives
          .filter((a) => !a.correct)
          .map((a) => (
            <li key={a.key} className="t-meta">
              <span className="mr-1.5 inline-flex rounded-full bg-mark-pink px-2 py-0.5 text-[12px] font-medium leading-4 text-on-mark">
                {a.letter} · {a.distractor}
              </span>
              <span className="text-ink-2">{a.rationale}</span>
            </li>
          ))}
      </ul>
      <p className="mt-3 t-meta text-ink-2">Classificação editorial demonstrativa; não é justificativa oficial do elaborador.</p>
    </section>
  );
}

