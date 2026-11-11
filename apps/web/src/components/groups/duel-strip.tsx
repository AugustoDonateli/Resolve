"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import type { DuelPlayer } from "@/lib/groups/data";

/**
 * Faixa do placar, como as bolhas de um cartão-resposta: preenchidas = acertos (quando revelados),
 * contorno cheio = respondidas, tracejado = ainda não. O texto ao lado repete tudo em palavras.
 */
export function DuelStrip({ player, total, revealed }: { player: DuelPlayer; total: number; revealed: boolean }) {
  const reduced = useReduced();
  const show = revealed || player.me;
  const correct = show ? (player.correct ?? 0) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate t-ui text-ink">
          {player.nickname}
          {player.me && <span className="t-meta text-ink-2"> (você)</span>}
        </span>
        <span className="shrink-0 t-meta tabular text-ink-2">
          {show && player.correct !== null
            ? `${player.correct} de ${total} acertos${player.finished ? "" : ` · ${player.answered} respondidas`}`
            : player.finished
              ? "terminou"
              : `${player.answered} de ${total} respondidas`}
        </span>
      </div>
      <ol className="flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const kind = i < correct ? "certa" : i < player.answered ? "respondida" : "falta";
          return (
            <motion.li
              key={i}
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: duration.state / 1000, ease: ease.state, delay: reduced ? 0 : i * 0.03 }}
              className={clsx(
                "size-4 rounded-full",
                kind === "certa" && "bg-ink",
                kind === "respondida" && "border-2 border-ink",
                kind === "falta" && "border border-dashed border-line",
              )}
            />
          );
        })}
      </ol>
    </div>
  );
}
