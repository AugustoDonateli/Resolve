"use client";

import { clsx } from "clsx";
import { Check, RotateCcw, Undo2, X } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";

export interface FeedCard {
  id: string;
  kind: "conceito" | "formula";
  front: string;
  back: string;
  source: string | null;
}

const THRESHOLD = 120;

/**
 * Revisão por gestos (M09): feed finito de cartões. O cartão de cima vira para mostrar o verso e, só
 * então, é arrastado para a direita (lembrei) ou para a esquerda (não lembrei). A resposta é registrada
 * antes da saída animada; soltar antes do limite devolve o cartão ao lugar (estado válido). Teclado e
 * botões fazem o mesmo; com movimento reduzido, o cartão some sem arremesso.
 */
export function CardFeed({
  cards,
  onAnswer,
  badge,
}: {
  cards: FeedCard[];
  onAnswer: (card: FeedCard, recalled: boolean) => Promise<string | null>;
  badge?: ReactNode;
}) {
  const reduced = useReduced();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ recalled: number; forgot: number }>({ recalled: 0, forgot: 0 });
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-8, 8]);
  const right = useTransform(x, [20, THRESHOLD], [0, 1]);
  const left = useTransform(x, [-THRESHOLD, -20], [1, 0]);
  const card = cards[index];
  const ref = useRef<HTMLDivElement>(null);

  const answer = useCallback(
    async (recalled: boolean) => {
      if (!card || busy || !flipped) return;
      setBusy(true);
      setError(null);
      const e = await onAnswer(card, recalled); // registra antes da saída
      if (e) {
        setBusy(false);
        setError(e);
        animate(x, 0, { duration: reduced ? 0 : duration.state / 1000 });
        return;
      }
      setResults((r) => (recalled ? { ...r, recalled: r.recalled + 1 } : { ...r, forgot: r.forgot + 1 }));
      if (!reduced) await animate(x, recalled ? 520 : -520, { duration: duration.layout / 1000, ease: ease.state });
      x.set(0);
      setFlipped(false);
      setIndex((i) => i + 1);
      setBusy(false);
    },
    [card, busy, flipped, onAnswer, reduced, x],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || (e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === " " || e.key === "Enter") {
        if (!flipped) {
          e.preventDefault();
          setFlipped(true);
        }
      } else if (e.key === "ArrowRight" && flipped) void answer(true);
      else if (e.key === "ArrowLeft" && flipped) void answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, answer]);

  if (!card) {
    const total = results.recalled + results.forgot;
    return (
      <section aria-labelledby="fim-cartoes" className="flex max-w-md flex-col gap-3 rounded-panel border border-line-subtle bg-surface px-6 py-8 text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-ink text-background">
          <Check className="size-6" strokeWidth={2.5} />
        </span>
        <h3 id="fim-cartoes" className="font-display text-[28px] leading-tight">
          Terminou por hoje
        </h3>
        <p className="t-reading text-ink-2">
          {total} {total === 1 ? "cartão" : "cartões"}: {results.recalled} lembrados, {results.forgot} para rever. Os que você não lembrou voltam
          antes.
        </p>
      </section>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="t-meta tabular text-ink-2" role="status">
          Cartão {index + 1} de {cards.length}
        </span>
        {badge}
      </div>
      <div className="relative h-[340px]">
        {/* próximos cartões, como papéis empilhados */}
        {cards.slice(index + 1, index + 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="absolute inset-x-0 top-0 h-full rounded-panel border border-line-subtle bg-surface"
            style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.03})`, zIndex: 2 - i }}
          />
        ))}
        <motion.div
          ref={ref}
          key={card.id}
          drag={flipped && !busy ? "x" : false}
          dragSnapToOrigin={false}
          dragElastic={0.6}
          style={{ x, rotate: reduced ? 0 : rotate, zIndex: 10 }}
          onDragEnd={(_, info) => {
            if (info.offset.x > THRESHOLD) void answer(true);
            else if (info.offset.x < -THRESHOLD) void answer(false);
            else animate(x, 0, { duration: reduced ? 0 : duration.state / 1000, ease: ease.state });
          }}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : duration.state / 1000 }}
          className={clsx(
            "absolute inset-x-0 top-0 flex h-full flex-col rounded-panel border border-line bg-surface p-6 shadow-paper",
            flipped && "cursor-grab active:cursor-grabbing",
          )}
          aria-roledescription="cartão de revisão"
          aria-label={`${card.kind === "formula" ? "Fórmula" : "Conceito"}: ${card.front}`}
        >
          <motion.span style={{ opacity: right }} className="absolute right-5 top-5 rounded-full bg-mark-yellow px-3 py-1 t-meta font-medium text-on-mark" aria-hidden>
            Lembrei
          </motion.span>
          <motion.span style={{ opacity: left }} className="absolute left-5 top-5 rounded-full bg-surface-subtle px-3 py-1 t-meta font-medium text-ink" aria-hidden>
            Não lembrei
          </motion.span>
          <p className="t-kicker">{card.kind === "formula" ? "Fórmula" : "Conceito"}</p>
          <p className="mt-4 font-display text-[24px] leading-snug text-ink">{card.front}</p>
          {flipped ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : duration.state / 1000 }}
              className="mt-4 flex flex-1 flex-col border-t border-dashed border-line-subtle pt-4"
            >
              <p className="whitespace-pre-line t-reading text-ink">{card.back}</p>
              <p className="mt-auto pt-3 t-meta text-ink-2">Fonte: {card.source ?? "indisponível"}</p>
            </motion.div>
          ) : (
            <div className="mt-auto">
              <Button type="button" variant="secondary" onClick={() => setFlipped(true)} icon={<RotateCcw aria-hidden className="size-4" />}>
                Mostrar o verso
              </Button>
            </div>
          )}
        </motion.div>
      </div>
      {flipped && (
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => void answer(false)} icon={<X aria-hidden className="size-4" />}>
            Não lembrei
          </Button>
          <Button type="button" className="flex-1" loading={busy} onClick={() => void answer(true)} icon={<Check aria-hidden className="size-4" />}>
            Lembrei
          </Button>
        </div>
      )}
      <p className="t-meta text-ink-2">
        {flipped ? "Arraste para a direita se lembrou, para a esquerda se não. Teclado: ← e →." : "Tente lembrar antes de virar. Teclado: espaço."}
      </p>
      <div aria-live="assertive">
        {error && (
          <p role="alert" className="flex items-center gap-2 t-ui">
            <Undo2 aria-hidden className="size-4" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
