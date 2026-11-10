"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CardFeed } from "./card-feed";
import { reviewCard, startReview } from "@/lib/study/actions";
import type { ReviewHome as Home } from "@/lib/study/review";
import { withSameAction } from "@/lib/study/retry";

const noop = () => () => {};

function actionIdFor(scope: string): string {
  const key = `resolve:acao:${scope}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const fmtDate = (d: string) => d.split("-").reverse().join("/");

/**
 * Revisão do dia (F3-T08). A fila vem do banco, sem seleção manual: o tempo disponível define o lote,
 * e o restante fica visível. Questões são respondidas antes de qualquer explicação; cartões pedem
 * lembrar antes de ver o verso. Nada avança sozinho.
 */
export function ReviewHome({ home }: { home: Home }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const batch = home.rows.filter((r) => r.in_batch);
  const rest = home.rows.length - batch.length;
  const questions = batch.filter((r) => r.kind === "questao");
  const cards = batch.filter(
    (r) => r.kind === "cartao" && r.card_id && home.cards[r.card_id],
  );

  return (
    <div className="flex flex-col gap-8">
      <nav
        aria-label="Tempo disponível"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="t-ui">Tempo para revisar:</span>
        {[15, 30, 60].map((m) => (
          <Link
            key={m}
            href={`/revisar?min=${m}`}
            aria-current={home.minutes === m ? "true" : undefined}
            className="inline-flex min-h-11 items-center rounded-control border border-line px-3 t-ui hover:bg-surface-subtle aria-[current]:border-ink aria-[current]:font-semibold"
          >
            {m} min
          </Link>
        ))}
      </nav>

      {home.rows.length === 0 ? (
        <section className="max-w-xl rounded-card border border-line-subtle bg-surface p-6">
          <h2 className="t-section">Nada para revisar hoje</h2>
          <p className="mt-1 t-reading text-ink-2">
            {home.nextDue
              ? `A próxima revisão vence em ${fmtDate(home.nextDue)}.`
              : "Quando você errar uma questão, ela volta aqui em 1, 3, 7, 14 e 30 dias."}
          </p>
          <Link
            href="/estudar"
            className="mt-4 inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
          >
            Ir para Estudar
          </Link>
          <Link href="/revisar/demonstracao" className="ml-4 mt-4 inline-flex min-h-11 items-center t-ui text-link underline">
            Ver como funciona a revisão por cartões
          </Link>
        </section>
      ) : (
        <>
          <p className="t-reading">
            {batch.length}{" "}
            {batch.length === 1 ? "revisão cabe" : "revisões cabem"} em{" "}
            {home.minutes} min ({home.minutesPerItem} min cada)
            {rest > 0
              ? `; ${rest} ${rest === 1 ? "fica" : "ficam"} para depois, das mais atrasadas às mais recentes.`
              : "."}
          </p>

          {questions.length > 0 && (
            <section
              aria-labelledby="rev-questoes"
              className="flex max-w-xl flex-col gap-3 rounded-panel border border-line bg-surface p-4 sm:p-6"
            >
              <h2 id="rev-questoes" className="t-section">
                Questões ({questions.length})
              </h2>
              <p className="t-meta text-ink-2">
                Responda de novo antes de ver a explicação. A agenda muda
                conforme a resposta.
              </p>
              <Button
                type="button"
                className="self-start"
                loading={pending}
                disabled={!hydrated}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await withSameAction(
                      actionIdFor(
                        `revisao-${home.rows[0]?.local_date}-${home.minutes}`,
                      ),
                      (actionId) =>
                        startReview({
                          actionId,
                          availableMinutes: home.minutes,
                        }),
                    );
                    if (r.ok) router.push(`/estudar/sessao/${r.value}`);
                    else
                      setError(
                        "Não foi possível abrir a revisão. Tente de novo.",
                      );
                  })
                }
              >
                Começar revisão
              </Button>
              <div aria-live="polite">
                {error && (
                  <p role="alert" className="t-ui">
                    {error}
                  </p>
                )}
              </div>
            </section>
          )}

          {cards.length > 0 && (
            <section
              aria-labelledby="rev-cartoes"
              className="flex max-w-xl flex-col gap-3"
            >
              <h2 id="rev-cartoes" className="t-section">
                Cartões ({cards.length})
              </h2>
              <CardFeed
                cards={cards.map((r) => {
                  const c = home.cards[r.card_id!]!;
                  return { id: c.id, kind: c.kind === "formula" ? "formula" : "conceito", front: c.front, back: c.back, source: c.source ? `${c.source} · ${c.locator}` : null };
                })}
                onAnswer={async (c, recalled) => {
                  const r = await withSameAction(actionIdFor(`cartao-${c.id}-${home.rows[0]?.local_date}`), (actionId) => reviewCard({ actionId, cardId: c.id, recalled }));
                  return r.ok ? null : "Não foi possível registrar. Tente de novo.";
                }}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
