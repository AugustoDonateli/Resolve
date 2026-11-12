import Link from "next/link";

export interface SumarioItem {
  href: string;
  title: string;
  /** Rótulo curto à direita da linha pontilhada (tipo de atividade, contagem ou "nesta página"). */
  tag?: string;
  body: string;
}

/**
 * Sumário de caderno: todos os destinos de uma seção, numerados, com linha pontilhada e uma frase
 * sobre cada um. É a forma padrão de mostrar "tudo o que há aqui" sem esconder nada atrás de menus.
 */
export function Sumario({ id, label = "Sumário", items }: { id: string; label?: string; items: SumarioItem[] }) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="mb-2 t-kicker">
        {label}
      </h2>
      <ol className="flex flex-col border-t-[1.5px] border-ink">
        {items.map((m, i) => (
          <li key={m.href}>
            <Link href={m.href} className="group grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-b border-line-subtle py-3">
              <span aria-hidden className="pt-0.5 font-mono text-[12px] tabular text-ink-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="t-ui text-ink [background:linear-gradient(currentColor,currentColor)_no-repeat_left_100%/0%_1.5px] transition-[background-size] duration-[var(--rs-dur-layout)] ease-layout group-hover:[background-size:100%_1.5px] group-focus-visible:[background-size:100%_1.5px]">
                    {m.title}
                  </span>
                  <span aria-hidden className="mb-1 min-w-6 flex-1 border-b border-dotted border-line" />
                  {m.tag && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-2">{m.tag}</span>}
                </span>
                <span className="mt-0.5 block t-meta text-ink-2">{m.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
