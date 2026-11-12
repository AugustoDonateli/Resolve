"use client";

import { usePathname } from "next/navigation";

/**
 * Enquanto a página nova carrega: a folha já está na mesa, com as linhas do cabeçalho em espera.
 * Aparece no instante do clique, para a troca de aba responder na hora. Em Hoje (que não usa a folha
 * única da estrutura) a espera traz a própria folha.
 */
export function SheetLoading() {
  const bare = usePathname() === "/hoje";
  const lines = (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Abrindo…</span>
      <div aria-hidden="true" className="border-b-[1.5px] border-ink pb-6">
        <div className="mb-3 h-3 w-40 rounded-sm bg-surface-subtle" />
        <div className="h-14 w-72 max-w-full rounded-sm bg-surface-subtle" />
      </div>
      <div aria-hidden="true" className="flex max-w-2xl flex-col gap-4">
        {[92, 78, 85, 60].map((w) => (
          <div key={w} className="h-4 rounded-sm bg-surface-subtle" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
  return bare ? <div className="sheet min-h-[60dvh] px-4 pb-16 pt-6 sm:px-6 md:min-h-[calc(100dvh-3rem)] md:max-w-[820px] md:pl-14 md:pr-12 md:pt-11">{lines}</div> : lines;
}
