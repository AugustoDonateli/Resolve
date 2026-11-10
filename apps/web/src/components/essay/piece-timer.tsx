"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Dez minutos para a proposta de intervenção (F5-T07). Opcional: o aluno inicia quando quiser; o fim do
 * tempo não trava o texto. O início fica guardado no aparelho para sobreviver a recarregar.
 */
export function PieceTimer({
  essayId,
  minutes,
}: {
  essayId: string;
  minutes: number;
}) {
  const key = `resolve:peca-tempo:${essayId}`;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem(key));
        if (saved > 0) setStartedAt(saved);
      } catch {
        // sem armazenamento: começa do zero
      }
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(t);
  }, [key]);
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const total = minutes * 60;
  const left = startedAt
    ? Math.max(0, total - Math.floor((now - startedAt) / 1000))
    : total;
  const begin = () => {
    const t = Date.now();
    try {
      localStorage.setItem(key, String(t));
    } catch {
      // segue sem guardar
    }
    setStartedAt(t);
    setNow(t);
  };
  return (
    <div
      role="group"
      aria-label="Tempo da peça"
      className="flex flex-wrap items-center gap-3 rounded-card border border-line-subtle bg-surface p-3"
    >
      <span className="t-section tabular-nums">{mmss(left)}</span>
      <span className="t-meta" role="status">
        {!startedAt
          ? `${minutes} minutos, se quiser cronometrar.`
          : left > 0
            ? "Cronometrando."
            : `Os ${minutes} minutos terminaram. Pode continuar escrevendo.`}
      </span>
      {!startedAt && (
        <Button type="button" size="sm" onClick={begin}>
          Iniciar {minutes} minutos
        </Button>
      )}
    </div>
  );
}
