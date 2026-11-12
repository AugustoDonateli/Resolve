"use client";

import type { CSSProperties } from "react";
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

  const startButton = (
    <Button
      type="button"
      className="self-start"
      loading={pending}
      disabled={!hydrated}
      onClick={() =>
        start(async () => {
          setError(null);
          const r = await withSameAction(actionIdFor(`revisao-${home.rows[0]?.local_date}-${home.minutes}`), (actionId) =>
            startReview({ actionId, availableMinutes: home.minutes }),
          );
          if (r.ok) router.push(`/estudar/sessao/${r.value}`);
          else setError("Não foi possível abrir a revisão. Tente de novo.");
        })
      }
    >
      Começar revisão
    </Button>
  );
  // O maço engrossa com a fila: uma ficha por revisão do lote, até sete visíveis.
  const under = Math.min(Math.max(batch.length - 1, 0), 6);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* O maço de fichas do dia */}
        <div className="flex flex-col gap-6">
          <div className="deck" style={{ "--n": under } as CSSProperties}>
            {Array.from({ length: under }, (_, i) => (
              <i key={i} aria-hidden="true" style={{ "--k": under - i } as CSSProperties} />
            ))}
            <section aria-labelledby="rev-maco" className="deck-top">
              <p className="t-kicker">Revisão de hoje</p>
              {home.rows.length === 0 ? (
                <>
                  <h2 id="rev-maco" className="mt-auto t-screen">
                    Nada para revisar hoje
                  </h2>
                  <p className="t-meta text-ink-2">
                    {home.nextDue ? `A próxima ficha vence em ${fmtDate(home.nextDue)}.` : "Quando você errar uma questão, ela vira uma ficha e volta aqui."}
                  </p>
                </>
              ) : (
                <>
                  <h2 id="rev-maco" className="mt-auto flex items-baseline gap-3">
                    <span className="t-display tabular">{batch.length}</span>
                    <span className="t-section">{batch.length === 1 ? "ficha" : "fichas"}</span>
                  </h2>
                  <p className="t-meta text-ink-2">
                    {batch.length === 1 ? "cabe" : "cabem"} em {home.minutes} min ({home.minutesPerItem} min cada)
                    {rest > 0 ? `; ${rest} ${rest === 1 ? "fica" : "ficam"} para depois, das mais atrasadas às mais recentes` : ""}.
                  </p>
                </>
              )}
            </section>
          </div>

          {home.rows.length === 0 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/estudar" className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover">
                Ir para Estudar
              </Link>
              <Link href="/revisar/demonstracao" className="inline-flex min-h-11 items-center t-ui text-link underline">
                Ver como funciona a revisão por cartões
              </Link>
            </div>
          ) : (
            questions.length > 0 && (
              <section aria-labelledby="rev-questoes" className="flex flex-col gap-3">
                <h2 id="rev-questoes" className="t-ui font-semibold">
                  Questões ({questions.length})
                </h2>
                <p className="-mt-2 t-meta text-ink-2">Responda de novo antes de ver a explicação. A agenda muda conforme a resposta.</p>
                {startButton}
                <div aria-live="polite">
                  {error && (
                    <p role="alert" className="t-ui">
                      {error}
                    </p>
                  )}
                </div>
              </section>
            )
          )}
        </div>

        <div className="flex flex-col gap-8">
          <nav aria-label="Tempo disponível" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 t-ui">Tempo para revisar:</span>
            {[15, 30, 60].map((m) => (
              <Link
                key={m}
                href={`/revisar?min=${m}`}
                aria-current={home.minutes === m ? "true" : undefined}
                className="inline-flex min-h-11 items-center rounded-control border-[1.5px] border-line-subtle px-3.5 t-ui hover:border-ink aria-[current]:border-ink aria-[current]:bg-ink aria-[current]:text-background"
              >
                {m} min
              </Link>
            ))}
          </nav>
          {/* Como a ficha volta: a regra dos intervalos, como uma linha do tempo */}
          <section aria-labelledby="rev-regra" className="max-w-xl">
            <h2 id="rev-regra" className="t-kicker">
              Quando cada ficha volta
            </h2>
            <ol className="mt-4 grid grid-cols-5 border-t-[1.5px] border-ink">
              {[1, 3, 7, 14, 30].map((d) => (
                <li key={d} className="relative pt-3">
                  <span aria-hidden className="absolute -top-[5px] left-0 size-[9px] rounded-full bg-ink" />
                  <span className="block font-display text-[30px] leading-none tabular">{d}</span>
                  <span className="t-meta text-ink-2">{d === 1 ? "dia" : "dias"}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 t-reading text-ink-2">
              Uma questão errada vira ficha e volta nesses intervalos. Acertou de novo, ela avança para o próximo; errou, recomeça do primeiro.
            </p>
          </section>
        </div>
      </div>

      {home.rows.length > 0 && (
        <>
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
