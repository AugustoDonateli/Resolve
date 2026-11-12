import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { DeskCounts } from "@/lib/today/desk";

/** Papel pousado na mesa: chega com um leve giro e se endireita quando você pega (hover ou foco). */
export function DeskObject({ i, r, className, children }: { i: number; r: string; className?: string; children: ReactNode }) {
  return (
    <div className={`desk-object ${className ?? ""}`} style={{ "--i": i, "--r": r } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Os outros objetos da mesa: caderno (Estudar), fichas (Revisar), folha (Redação) e régua (Progresso).
 * São atalhos com o mesmo destino das divisórias; os números vêm da conta e somem quando indisponíveis.
 */
export function DeskObjects({ counts }: { counts: DeskCounts }) {
  const due = counts.reviewDue;
  return (
    <nav aria-label="Objetos da mesa" className="grid grid-cols-2 items-end gap-x-5 gap-y-7 pt-1">
      <Link href="/estudar" className="desk-object desk-book group" style={{ "--i": 2, "--r": "-2.2deg" } as CSSProperties}>
        <span className="desk-book-page" aria-hidden="true" />
        <span className="desk-book-cover">
          <span className="font-mono text-[9.5px] uppercase leading-4 tracking-[0.1em]">Caderno de questões</span>
          <span className="font-display text-[40px] leading-[0.9]">Estudar</span>
          <span className="font-mono text-[9.5px] uppercase leading-4 tracking-[0.1em]">
            {counts.questions !== null ? `${counts.questions} questões oficiais` : "Questões oficiais"}
          </span>
        </span>
      </Link>

      <div className="flex flex-col gap-7">
        <Link href="/revisar" className="desk-object desk-cards group" style={{ "--i": 3, "--r": "3deg" } as CSSProperties}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span className="desk-cards-top">
            <span className="t-kicker !text-ink">Revisar</span>
            <span className="font-display text-[26px] leading-none text-ink">
              {due === null ? "Fichas" : due === 0 ? "Em dia" : `${due} ${due === 1 ? "ficha" : "fichas"}`}
            </span>
            {due !== null && due > 0 && <span className="t-meta text-ink">para hoje</span>}
          </span>
        </Link>
        <Link href="/redacao" className="desk-object desk-folha ruled" style={{ "--i": 4, "--r": "-1.6deg", "--pauta": "18px" } as CSSProperties}>
          <span className="font-display text-[26px] leading-none text-ink">Redação</span>
          <span className="desk-folha-mao t-hand text-primary" aria-hidden="true">
            30 linhas
          </span>
        </Link>
      </div>

      <Link href="/progresso" className="desk-object desk-regua col-span-2" style={{ "--i": 5, "--r": "0.5deg" } as CSSProperties}>
        <span className="desk-regua-marca" aria-hidden="true" />
        <span className="relative font-mono text-[10.5px] uppercase tracking-[0.1em]">Progresso</span>
        <span className="relative font-mono text-[10.5px] uppercase tracking-[0.1em]">0 — 1000</span>
      </Link>
    </nav>
  );
}
