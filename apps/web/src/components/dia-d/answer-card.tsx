"use client";

import { clsx } from "clsx";
import type { KeyboardEvent } from "react";
import { CROSS, ring, scribble, seedOf } from "@/lib/ink/paths";

type Letter = "A" | "B" | "C" | "D" | "E";
const LETTERS: Letter[] = ["A", "B", "C", "D", "E"];
/** Um desenho de bolinha por letra (o cartão inteiro reutiliza os mesmos cinco). */
const SHAPE = Object.fromEntries(LETTERS.map((l) => [l, { ring: ring(13.2, seedOf(`cartao-${l}`)), fill: scribble(12.4, seedOf(`cartao-${l}`) + 5), circle: ring(18.5, seedOf(`cartao-${l}`) + 23, 1.8) }])) as Record<Letter, { ring: string; fill: string; circle: string }>;

export interface CardEntry {
  position: number;
  /** Marcação de trabalho no caderno. */
  work: Letter | null;
  /** O que vale: a letra transcrita no cartão. */
  card: Letter | null;
  annulled: boolean;
  /** Gabarito, só depois da entrega. */
  correct: Letter | null;
}

/**
 * Cartão-resposta: uma linha por questão, cinco bolinhas. Clicar preenche à caneta; clicar na mesma
 * limpa. Setas ← → andam pelas letras da linha. Ao lado, a marcação do caderno e o aviso quando ela
 * diverge do cartão. Depois da entrega, a caneta do corretor circula o gabarito e põe xis no erro.
 */
export function AnswerCard({
  items,
  ended,
  locked,
  onMark,
  onOpen,
}: {
  items: CardEntry[];
  ended: boolean;
  locked: boolean;
  onMark: (position: number, letter: Letter | null) => void;
  onOpen: (position: number) => void;
}) {
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const sib = (e.key === "ArrowRight" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
    if (sib?.getAttribute("role") === "radio") {
      e.preventDefault();
      sib.focus();
    }
  };
  return (
    <ol className="cartao-resposta">
      {items.map((it) => {
        const diverges = !ended && it.work !== null && it.work !== it.card;
        return (
          <li key={it.position} className={clsx("cartao-linha", it.annulled && "opacity-60")}>
            <button
              type="button"
              className="w-9 shrink-0 text-right font-mono text-[13px] tabular text-ink underline decoration-line-subtle underline-offset-4 hover:decoration-ink"
              disabled={!ended && locked}
              onClick={() => onOpen(it.position)}
              aria-label={`Abrir questão ${it.position}`}
            >
              {String(it.position).padStart(2, "0")}
            </button>
            <span role="radiogroup" aria-label={`Cartão, questão ${it.position}`} className="flex gap-0.5">
              {LETTERS.map((l, i) => {
                const on = it.card === l;
                const isCorrect = ended && it.correct === l;
                const wrong = ended && on && it.correct !== null && it.correct !== l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${l}${isCorrect ? " (gabarito)" : ""}`}
                    tabIndex={on || (it.card === null && i === 0) ? 0 : -1}
                    disabled={ended || locked || it.annulled}
                    onKeyDown={move}
                    onClick={() => onMark(it.position, on ? null : l)}
                    className="cartao-bolha"
                  >
                    <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0 size-full overflow-visible">
                      <path d={SHAPE[l].ring} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                      {on && (
                        <path d={SHAPE[l].fill} pathLength={1} fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" className="cartao-rabisco" clipPath="circle(12.6px at 22px 22px)" />
                      )}
                      {isCorrect && <path d={SHAPE[l].circle} pathLength={1} fill="none" className="cartao-traco stroke-pen" strokeWidth={2} strokeLinecap="round" />}
                      {wrong && <path d={CROSS} pathLength={1} fill="none" className="cartao-traco stroke-pen" strokeWidth={2.8} strokeLinecap="round" />}
                    </svg>
                    <span className={clsx("relative", on && "text-background")}>{l}</span>
                  </button>
                );
              })}
            </span>
            <span className="min-w-0 flex-1 truncate pl-1 t-meta text-ink-2">
              {it.annulled ? (
                "Anulada"
              ) : ended ? (
                it.card === null ? (
                  "em branco"
                ) : it.card === it.correct ? (
                  "certa"
                ) : (
                  `gabarito ${it.correct ?? "indisponível"}`
                )
              ) : diverges ? (
                <span className="rounded-sm bg-mark-yellow px-1.5 py-0.5 text-on-mark">caderno: {it.work}</span>
              ) : it.work ? (
                <span aria-label={`Caderno: ${it.work}`}>caderno: {it.work}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
