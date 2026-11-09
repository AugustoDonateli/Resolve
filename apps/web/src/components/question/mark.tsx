"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";

/**
 * Marca-texto (identidade A): preenchimento amarelo/rosa que corre da esquerda
 * para a direita sobre o trecho, com texto em tinta. Fundo, não texto colorido.
 * Nenhuma reflow: só muda o background, a posição de leitura fica intacta.
 */
export function Mark({
  on,
  color,
  anchor,
  children,
  delay = 0,
  onActivate,
  label,
}: {
  on: boolean;
  color: "yellow" | "pink";
  anchor?: string;
  children: ReactNode;
  delay?: number;
  onActivate?: () => void;
  label?: string;
}) {
  const reduced = useReduced();
  const interactive = on && onActivate;
  return (
    <motion.span
      data-anchor={anchor}
      data-on={on}
      className={clsx("mark", color === "yellow" ? "mark-yellow" : "mark-pink", interactive && "cursor-pointer")}
      initial={false}
      animate={{ "--sweep": on ? 1 : 0 } as never}
      transition={{ duration: reduced ? 0 : duration.evidence / 1000, ease: ease.evidence, delay: reduced || !on ? 0 : delay }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
    >
      {children}
      {interactive && label && <span className="sr-only"> ({label})</span>}
    </motion.span>
  );
}
