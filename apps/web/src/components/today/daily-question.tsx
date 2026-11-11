"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startDailyQuestion } from "@/lib/study/actions";
import { AREA_LABEL } from "@/lib/study/question-types";
import type { DailyQuestion as Daily } from "@/lib/study/daily";

/**
 * Questão do dia: uma questão real publicada, a mesma o dia inteiro, escolhida entre as que a conta
 * ainda não tinha respondido. Responder abre uma sessão de uma questão (com Raio-X e caderno de erros).
 */
export function DailyQuestion({ q, today }: { q: Daily | null; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="questao-do-dia" className="relative rounded-card border border-line-subtle bg-surface px-5 pb-5 pt-6">
      {/* aba de papel: preenchimento amarelo com texto em tinta */}
      <span aria-hidden className="absolute -top-2.5 left-5 rounded-sm bg-mark-yellow px-2 py-0.5 t-meta font-medium text-on-mark">
        {today.slice(8, 10)}/{today.slice(5, 7)}
      </span>
      <h2 id="questao-do-dia" className="t-kicker">
        Questão do dia
      </h2>
      {!q ? (
        <p className="mt-2 t-meta text-ink-2">
          Aparece quando houver questões oficiais publicadas que você ainda não respondeu.
        </p>
      ) : q.answered ? (
        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-line">
            {q.isCorrect ? <Check className="size-4" strokeWidth={2.5} /> : <X className="size-4" strokeWidth={2.5} />}
          </span>
          <p className="t-ui">
            {AREA_LABEL[q.area]}: {q.isCorrect ? "você acertou." : "você errou; ela foi para o caderno de erros."}
            <span className="block t-meta text-ink-2">Amanhã tem outra.</span>
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 font-display text-[26px] leading-tight text-ink">{AREA_LABEL[q.area]}</p>
          <p className="mt-1 t-meta text-ink-2">Uma questão oficial que você ainda não respondeu. A mesma até o fim do dia.</p>
          <Button
            className="mt-4"
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await startDailyQuestion({ actionId: crypto.randomUUID(), itemVersionId: q.itemVersionId, today });
                if (r.ok) router.push(`/estudar/sessao/${r.value}`);
                else setError(r.error === "resolve_no_items" ? "A questão do dia mudou. Recarregue a página." : "Não foi possível abrir. Tente de novo.");
              })
            }
          >
            Responder
          </Button>
          {error && (
            <p role="alert" className="mt-2 t-meta">
              {error} <Link href="/hoje" className="underline">Recarregar</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
