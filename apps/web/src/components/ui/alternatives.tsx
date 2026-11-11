"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { clsx } from "clsx";
import { Scissors, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { CHECK, CROSS, SLASH, ring, scribble, seedOf } from "@/lib/ink/paths";

export type Letter = "A" | "B" | "C" | "D" | "E";

export interface AlternativeItem {
  key: string;
  letter: Letter;
  content: ReactNode;
}

export type Reveal = { correctKey: string } | null;

interface Props {
  name: string;
  items: AlternativeItem[];
  value: string | null;
  onValueChange: (key: string) => void;
  eliminated: ReadonlySet<string>;
  onToggleEliminate: (key: string) => void;
  /** Resposta confirmada: trava a escolha. */
  confirmed: boolean;
  /** Gabarito revelado somente após a confirmação. */
  reveal: Reveal;
  /** Anotações exibidas na faixa reservada à direita (ex.: tipo de distrator no Raio-X). */
  aside?: (key: string) => ReactNode;
  labelledBy: string;
}

/**
 * Alternativas, como no cartão-resposta: a bolinha é um círculo feito à mão; marcar preenche com
 * rabisco de caneta; eliminar risca o texto; depois da confirmação, a caneta do corretor circula a
 * certa e põe um xis na errada. A escolha é registrada antes do traço; o texto e a geometria não se
 * deslocam (a faixa de status tem largura reservada); o estado nunca depende só de cor.
 */
export function Alternatives({
  name,
  items,
  value,
  onValueChange,
  eliminated,
  onToggleEliminate,
  confirmed,
  reveal,
  aside,
  labelledBy,
}: Props) {
  const reduced = useReduced();
  const pen = (ms: number, delay = 0) => ({ duration: reduced ? 0 : ms / 1000, delay: reduced ? 0 : delay / 1000, ease: ease.evidence });
  const shapes = useMemo(
    () => Object.fromEntries(items.map((it) => { const s = seedOf(it.letter); return [it.key, { ring: ring(13.4, s), fill: scribble(12.6, s + 7), circle: ring(19, s + 31, 1.85) }]; })),
    [items],
  );
  return (
    <RadioGroup.Root
      name={name}
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={confirmed}
      aria-labelledby={labelledBy}
      className="flex flex-col"
    >
      {items.map((it) => {
        const selected = value === it.key;
        const isEliminated = eliminated.has(it.key) && !selected;
        const isCorrect = reveal?.correctKey === it.key;
        const isWrongChoice = Boolean(reveal) && selected && !isCorrect;
        const shape = shapes[it.key]!;
        const clip = `${name}-${it.key}-clip`;
        return (
          <div
            key={it.key}
            data-alt={it.key}
            data-state={selected ? "checked" : "unchecked"}
            className="group relative grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-line-subtle py-2.5 first:border-t-0"
          >
            <RadioGroup.Item
              value={it.key}
              id={`${name}-${it.key}`}
              aria-describedby={reveal ? `${name}-${it.key}-status` : undefined}
              className="peer relative grid size-11 shrink-0 place-items-center rounded-full font-sans text-[15px] font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-link disabled:cursor-default"
            >
              <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 size-full overflow-visible">
                <defs>
                  <clipPath id={clip}>
                    <circle cx="22" cy="22" r="12.8" />
                  </clipPath>
                </defs>
                <path d={shape.ring} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                <g clipPath={`url(#${clip})`}>
                  <motion.path
                    d={shape.fill}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                    transition={selected ? pen(duration.evidence) : pen(duration.state)}
                  />
                </g>
                {isEliminated && (
                  <motion.path d={SLASH} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={pen(duration.layout)} />
                )}
                {isCorrect && (
                  <motion.path d={shape.circle} fill="none" className="stroke-pen" strokeWidth={1.9} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={pen(duration.evidenceMax, isWrongChoice ? 0 : 120)} />
                )}
                {isWrongChoice && (
                  <motion.path d={CROSS} fill="none" className="stroke-pen" strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={pen(duration.layout)} />
                )}
              </svg>
              <span className={clsx("relative tabular transition-colors duration-[var(--rs-dur-state)]", selected ? "text-background delay-150" : "text-ink")}>{it.letter}</span>
            </RadioGroup.Item>

            <label
              htmlFor={`${name}-${it.key}`}
              className={clsx("t-reading min-w-0 cursor-pointer self-center py-1", isEliminated && "text-ink-2", confirmed && "cursor-default")}
            >
              <span className="pen-strike" data-on={isEliminated}>
                {it.content}
              </span>
              {isEliminated && <span className="sr-only"> (eliminada por você)</span>}
            </label>

            {/* Faixa reservada: largura fixa evita deslocamento quando o status aparece. */}
            <div className="flex w-10 flex-col items-end gap-1 self-center sm:w-28">
              {reveal ? (
                <span id={`${name}-${it.key}-status`} className="flex items-center gap-1.5 t-meta text-ink">
                  {isCorrect && (
                    <>
                      <svg aria-hidden="true" viewBox="0 0 44 44" className="size-5 overflow-visible">
                        <motion.path d={CHECK} fill="none" className="stroke-pen" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={pen(duration.evidenceMin, 260)} />
                      </svg>
                      <span className="max-sm:sr-only">Correta</span>
                    </>
                  )}
                  {isWrongChoice && <span className="max-sm:sr-only">Sua resposta</span>}
                  {isCorrect && selected && <span className="sr-only">e sua resposta</span>}
                </span>
              ) : (
                !confirmed && (
                  <button
                    type="button"
                    onClick={() => onToggleEliminate(it.key)}
                    disabled={selected}
                    aria-pressed={eliminated.has(it.key)}
                    aria-label={eliminated.has(it.key) ? `Restaurar alternativa ${it.letter}` : `Eliminar alternativa ${it.letter}`}
                    className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors duration-[var(--rs-dur-press)] hover:bg-surface-subtle hover:text-ink disabled:opacity-0"
                  >
                    {eliminated.has(it.key) ? <Undo2 aria-hidden="true" className="size-4" /> : <Scissors aria-hidden="true" className="size-4" />}
                  </button>
                )
              )}
              {aside?.(it.key)}
            </div>
          </div>
        );
      })}
    </RadioGroup.Root>
  );
}
