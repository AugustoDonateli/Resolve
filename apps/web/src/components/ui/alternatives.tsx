"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { clsx } from "clsx";
import { Check, Scissors, Undo2, X } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";

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
  /** Gabarito revelado somente após a confirmação (plano §3, regra 1). */
  reveal: Reveal;
  /** Anotações exibidas na faixa reservada à direita (ex.: tipo de distrator no Raio-X). */
  aside?: (key: string) => ReactNode;
  labelledBy: string;
}

/**
 * Alternativas (plano §6 e §8): neutra, foco, selecionada, eliminada pelo aluno,
 * confirmada e correta/incorreta com texto e ícone. Geometria e texto não se
 * deslocam: a faixa de status tem largura reservada desde o primeiro quadro.
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
  return (
    <RadioGroup.Root
      name={name}
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={confirmed}
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2"
    >
      {items.map((it) => {
        const selected = value === it.key;
        const isEliminated = eliminated.has(it.key) && !selected;
        const isCorrect = reveal?.correctKey === it.key;
        const isWrongChoice = reveal && selected && !isCorrect;
        return (
          <div
            key={it.key}
            data-alt={it.key}
            className={clsx(
              "group relative grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-card border px-3 py-3 sm:px-4",
              "transition-[border-color,background-color] duration-[var(--rs-dur-press)] ease-press",
              selected ? "border-ink bg-surface" : "border-line-subtle bg-surface hover:border-line",
              isCorrect && "border-ink",
            )}
          >
            <RadioGroup.Item
              value={it.key}
              id={`${name}-${it.key}`}
              aria-describedby={reveal ? `${name}-${it.key}-status` : undefined}
              className="peer relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 border-line bg-surface t-ui text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link data-[state=checked]:border-ink disabled:cursor-default"
            >
              {/* Tinta preenche a bolinha a partir do centro (120 ms). */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-[3px] rounded-full bg-ink"
                initial={false}
                animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : duration.press / 1000, ease: ease.press }}
              />
              <span className={clsx("relative tabular", selected ? "text-background" : "text-ink")}>{it.letter}</span>
              {isEliminated && (
                <svg aria-hidden="true" viewBox="0 0 32 32" className="absolute inset-0 text-ink-2">
                  <line x1="7" y1="25" x2="25" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </RadioGroup.Item>

            <label
              htmlFor={`${name}-${it.key}`}
              className={clsx(
                "t-reading min-w-0 cursor-pointer pt-0.5",
                isEliminated && "text-ink-2 line-through decoration-ink-2 decoration-1",
                confirmed && "cursor-default",
              )}
            >
              {it.content}
              {isEliminated && <span className="sr-only"> (eliminada por você)</span>}
            </label>

            {/* Faixa reservada: largura fixa evita deslocamento quando o status aparece. */}
            <div className="flex w-10 flex-col items-end gap-1 sm:w-28">
              {reveal ? (
                <span id={`${name}-${it.key}-status`} className="flex items-center gap-1 t-meta text-ink">
                  {isCorrect && (
                    <>
                      <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                      <span className="max-sm:sr-only">Correta</span>
                    </>
                  )}
                  {isWrongChoice && (
                    <>
                      <X aria-hidden="true" className="size-4" strokeWidth={2.5} />
                      <span className="max-sm:sr-only">Sua resposta</span>
                    </>
                  )}
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
                    className="grid size-9 place-items-center rounded-control text-ink-2 transition-colors duration-[var(--rs-dur-press)] hover:bg-surface-subtle hover:text-ink disabled:opacity-0"
                  >
                    {eliminated.has(it.key) ? (
                      <Undo2 aria-hidden="true" className="size-4" />
                    ) : (
                      <Scissors aria-hidden="true" className="size-4" />
                    )}
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
