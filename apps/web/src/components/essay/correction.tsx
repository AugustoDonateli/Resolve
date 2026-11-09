"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { clsx } from "clsx";
import { ArrowDown, Check, ChevronRight, CircleDashed, Layers } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { isOffscreen, MarginNotes } from "@/components/question/margin-notes";
import { Mark } from "@/components/question/mark";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { demoEssay as E, type CompetencyCode, type EssayAnnotation } from "@/lib/demo/essay";
import type { Segment } from "@/lib/demo/question";
import { PenStroke } from "./pen-stroke";

/**
 * Correção (T19; protótipo F1-T06 + F1-T18, parte correção).
 * Trocar competência: a aba conduz o olhar ao trecho; um traço curto e o
 * preenchimento acompanham a abertura do comentário. Sem rolagem automática
 * longa — se o trecho estiver fora da tela, oferecemos “Ir ao trecho”.
 */
export function Correction() {
  const reduced = useReduced();
  const [tab, setTab] = useState<CompetencyCode>("C1");
  const [index, setIndex] = useState(0);
  const [element, setElement] = useState<string | null>(null);
  const [layers, setLayers] = useState<Set<CompetencyCode>>(new Set());
  const [offscreen, setOffscreen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => E.annotations.filter((a) => a.competency === tab), [tab]);
  const current: EssayAnnotation | undefined = list[index];
  const activeAnchor = element ?? current?.anchor ?? null;
  const total = E.competencies.reduce((s, c) => s + c.score, 0);

  useEffect(() => {
    if (!activeAnchor) return;
    const check = () => setOffscreen(isOffscreen(textRef.current?.querySelector(`[data-anchor="${activeAnchor}"]`) ?? null));
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [activeAnchor]);

  const layerAnchors = new Set(E.annotations.filter((a) => layers.has(a.competency)).map((a) => a.anchor));

  const goTo = () => {
    textRef.current?.querySelector(`[data-anchor="${activeAnchor}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  };

  const renderSegments = (segs: Segment[]) =>
    segs.map((s, i) => {
      if (!s.anchor) return <Fragment key={i}>{s.text}</Fragment>;
      const isActive = s.anchor === activeAnchor;
      const inLayer = layerAnchors.has(s.anchor);
      const inProposal = tab === "C5" && s.anchor.startsWith("c5-");
      return (
        <Mark key={i} anchor={s.anchor} on={isActive || inLayer || inProposal} color={isActive ? "pink" : "yellow"} delay={0.12}>
          {s.text}
        </Mark>
      );
    });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="t-meta font-medium uppercase tracking-[0.08em] text-ink-2">Correção</span>
        <DemoBadge>Correção demonstrativa · não é avaliação real nem IA</DemoBadge>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-meta text-ink-2">Tema</p>
          <h2 className="t-section">{E.prompt}</h2>
        </div>
        <div className="text-right">
          <p className="t-meta text-ink-2">Total demonstrativo</p>
          <p className="t-metric">{total}</p>
        </div>
      </div>

      <Tabs.Root
        value={tab}
        onValueChange={(v) => {
          setTab(v as CompetencyCode);
          setIndex(0);
          setElement(null);
        }}
      >
        <LayoutGroup id="competencias">
          <Tabs.List aria-label="Competências" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {E.competencies.map((c) => {
              const active = tab === c.code;
              return (
                <Tabs.Trigger
                  key={c.code}
                  value={c.code}
                  className={clsx(
                    "relative flex min-h-14 shrink-0 flex-col items-start justify-center rounded-control px-3.5 py-2 text-left transition-colors duration-[var(--rs-dur-state)]",
                    active ? "text-on-mark" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="comp-indicator"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-control bg-mark-yellow"
                      transition={{ duration: reduced ? 0 : duration.state / 1000, ease: ease.state }}
                    />
                  )}
                  <span className="relative t-ui">
                    {c.code} <span className="tabular">{c.score}</span>
                  </span>
                  <span className="relative t-meta">{c.label}</span>
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </LayoutGroup>

        <div ref={scopeRef} className="mt-6 grid gap-x-10 md:grid-cols-[minmax(0,68ch)_minmax(220px,280px)]">
          <div className="min-w-0">
            <div className="rounded-panel border border-line-subtle bg-surface p-5 sm:p-7">
              <div ref={textRef} className="relative flex flex-col gap-4 t-reading text-ink">
                {E.paragraphs.map((p, i) => (
                  <div key={i}>
                    <p>{renderSegments(p)}</p>
                    {/* Celular: comentário logo abaixo do parágrafo do trecho. */}
                    <AnimatePresence initial={false}>
                      {current && !element && p.some((s) => s.anchor === current.anchor) && (
                        <motion.div
                          key={current.id}
                          className="overflow-hidden md:hidden"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: reduced ? 0 : duration.layout / 1000, ease: ease.layout }}
                        >
                          <CommentCard a={current} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                <PenStroke scopeRef={textRef} anchor={activeAnchor} strokeKey={`${tab}-${index}-${element ?? ""}`} />
              </div>
              <p className="mt-5 t-meta text-ink-2">{E.note}</p>
            </div>

            {E.competencies.map((c) => (
              <Tabs.Content key={c.code} value={c.code} className="mt-4 outline-none">
                <section className="rounded-panel border border-ink bg-surface p-4 sm:p-5" aria-label={`Comentários de ${c.code}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="t-ui">
                      {c.code} · {c.label}
                    </p>
                    {list.length > 1 && (
                      <p className="t-meta tabular text-ink-2">
                        Anotação {index + 1} de {list.length}
                      </p>
                    )}
                  </div>
                  <div aria-live="polite" className="mt-2">
                    {current && (
                      <p className="t-meta">
                        <span className="font-medium text-ink">{current.title}. </span>
                        <span className="text-ink-2">{current.comment}</span>
                      </p>
                    )}
                  </div>
                  {c.code === "C5" && <ProposalElements selected={element} onSelect={setElement} />}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {list.length > 1 && (
                      <Button size="sm" onClick={() => setIndex((i) => (i + 1) % list.length)} icon={<ChevronRight aria-hidden className="size-4" />}>
                        Próxima anotação
                      </Button>
                    )}
                    {offscreen && (
                      <Button size="sm" variant="secondary" onClick={goTo} icon={<ArrowDown aria-hidden className="size-4" />}>
                        Ir ao trecho
                      </Button>
                    )}
                  </div>
                </section>
              </Tabs.Content>
            ))}

            <LayerToggles layers={layers} onChange={setLayers} />
          </div>

          <MarginNotes
            className="hidden md:block"
            scopeRef={scopeRef}
            notes={
              current && !element
                ? [{ id: current.id, anchor: current.anchor, color: "pink", title: `${current.competency} · ${current.title}`, body: current.comment }]
                : []
            }
          />
        </div>
      </Tabs.Root>
    </div>
  );
}

function CommentCard({ a }: { a: EssayAnnotation }) {
  return (
    <div className="mt-3 flex gap-3 rounded-card border border-line-subtle bg-surface-subtle p-3">
      <span aria-hidden="true" className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-mark-pink" />
      <div>
        <p className="t-meta font-medium text-ink">
          {a.competency} · {a.title}
        </p>
        <p className="t-meta text-ink-2">{a.comment}</p>
      </div>
    </div>
  );
}

function ProposalElements({ selected, onSelect }: { selected: string | null; onSelect: (a: string | null) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-2 t-meta text-ink-2">Cinco elementos da proposta</p>
      <ul className="flex flex-wrap gap-2">
        {E.proposal.map((el) => (
          <li key={el.key}>
            {el.anchor ? (
              <button
                type="button"
                aria-pressed={selected === el.anchor}
                onClick={() => onSelect(selected === el.anchor ? null : el.anchor)}
                className={clsx(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 t-meta transition-colors duration-[var(--rs-dur-press)]",
                  selected === el.anchor ? "border-ink bg-ink text-background" : "border-line text-ink hover:bg-surface-subtle",
                )}
              >
                <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                {el.label}
              </button>
            ) : (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3 t-meta text-ink-2">
                <CircleDashed aria-hidden="true" className="size-3.5" />
                {el.label}: não encontrado no texto
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayerToggles({ layers, onChange }: { layers: Set<CompetencyCode>; onChange: (s: Set<CompetencyCode>) => void }) {
  return (
    <fieldset className="mt-4 rounded-card border border-line-subtle bg-surface p-4">
      <legend className="sr-only">Camadas de marcação</legend>
      <p className="mb-2 flex items-center gap-2 t-ui">
        <Layers aria-hidden="true" className="size-4" />
        Camadas
      </p>
      <p className="mb-3 t-meta text-ink-2">Mostre os trechos de outras competências ao mesmo tempo. Cada camada liga e desliga sozinha.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {E.competencies.map((c) => (
          <label key={c.code} className="flex min-h-9 cursor-pointer items-center gap-2 t-meta">
            <input
              type="checkbox"
              className="size-4 accent-[var(--rs-primary)]"
              checked={layers.has(c.code)}
              onChange={(e) => {
                const next = new Set(layers);
                if (e.target.checked) next.add(c.code);
                else next.delete(c.code);
                onChange(next);
              }}
            />
            {c.code} · {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
