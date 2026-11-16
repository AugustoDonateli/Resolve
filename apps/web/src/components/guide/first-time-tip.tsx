"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { markGuide } from "@/lib/guide/actions";
import { TIPS, type TipKey } from "@/lib/guide/types";

/** O conteúdo de uma dica: o que é, quando usar e quanto tempo leva. Usado na ficha e em "Como funciona". */
export function TipBody({ tip }: { tip: TipKey }) {
  const t = TIPS[tip];
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 t-ui font-normal text-ink">
      <dt className="t-kicker pt-1">O que é</dt>
      <dd>{t.what}</dd>
      <dt className="t-kicker pt-1">Quando usar</dt>
      <dd>{t.when}</dd>
      <dt className="t-kicker pt-1">Quanto tempo</dt>
      <dd>{t.time}</dd>
    </dl>
  );
}

/**
 * Dica da primeira vez: uma ficha curta no lugar em que o recurso começa. Aparece uma vez só — fica
 * registrada como vista quando entra na tela — e continua guardada em "Como funciona".
 */
export function FirstTimeTip({ tip, seen, className }: { tip: TipKey; seen: boolean; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [closed, setClosed] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (marked.current || !entries.some((e) => e.isIntersecting)) return;
        marked.current = true;
        io.disconnect();
        void markGuide(tip);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, tip]);

  if (seen || closed) return null;
  const id = `dica-${tip}`;
  return (
    <aside ref={ref} aria-labelledby={id} className={`rounded-card border border-line-subtle bg-surface p-4 shadow-paper sm:p-5 ${className ?? ""}`}>
      <p className="t-kicker">Primeira vez aqui</p>
      <h3 id={id} className="mb-3 mt-0.5 font-display text-[24px] leading-tight text-ink">
        {TIPS[tip].title}
      </h3>
      <TipBody tip={tip} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="t-meta text-ink-2">
          Esta ficha aparece uma vez. Depois, fica em{" "}
          <Link href="/mais/como-funciona" className="text-link underline">
            Como funciona
          </Link>
          .
        </p>
        <Button variant="secondary" size="sm" onClick={() => setClosed(true)}>
          Entendi
        </Button>
      </div>
    </aside>
  );
}
