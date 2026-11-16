"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markGuide, startFirstQuestion } from "@/lib/guide/actions";
import { currentStep, FIRST_STEPS, type FichaDefaults, type FirstStep, type GuideState } from "@/lib/guide/types";
import { CHECK } from "@/lib/ink/paths";
import { DeskTour } from "./desk-tour";
import { FichaForm } from "./ficha-form";

const noop = () => () => {};

const TITLE: Record<FirstStep, string> = {
  ficha: "Ficha de identificação",
  primeira_questao: "Primeira questão",
  tour: "Tour da mesa",
};

/**
 * Primeiros passos, na própria mesa: a ficha de identificação, uma questão real e o tour dos objetos.
 * Um passo aberto por vez, cada um com uma ação e um "pular"; o que foi feito fica riscado com um visto.
 * Some quando os três estiverem feitos. O tour também abre por pedido (`autoTour`), vindo de outra tela.
 */
export function FirstSteps({
  guide,
  ficha,
  autoTour,
}: {
  guide: Pick<GuideState, FirstStep>;
  ficha: FichaDefaults | null;
  autoTour: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(guide);
  const [touring, setTouring] = useState(autoTour);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const step = currentStep(done);
  // O tour mede os objetos na tela: só existe no navegador, depois que a página está montada.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const finish = (key: FirstStep, record = true) => {
    setDone((d) => ({ ...d, [key]: true }));
    setMessage(null);
    if (record)
      start(async () => {
        await markGuide(key);
        router.refresh();
      });
    else router.refresh();
  };

  const tour = mounted && touring && (
    <DeskTour
      onDone={() => {
        setTouring(false);
        // Aberto por pedido (?tour=1): ao sair, o endereço volta a ser só Hoje. Uma navegação por vez:
        // primeiro o registro, depois a troca de endereço (que já traz a página atualizada).
        const leave = () => (autoTour ? router.replace("/hoje", { scroll: false }) : router.refresh());
        if (done.tour) {
          if (autoTour) leave();
          return;
        }
        setDone((d) => ({ ...d, tour: true }));
        start(async () => {
          await markGuide("tour");
          leave();
        });
      }}
    />
  );
  if (!step) return tour || null;

  return (
    <section aria-labelledby="primeiros-passos" className="relative rounded-card border border-line-subtle bg-surface px-5 pb-6 pt-5 shadow-paper sm:px-7">
      {tour}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="primeiros-passos" className="t-kicker">
          Primeiros passos · {FIRST_STEPS.indexOf(step) + 1} de {FIRST_STEPS.length}
        </h2>
        <p className="t-meta text-ink-2">Uns 5 minutos. Dá para pular qualquer um.</p>
      </div>
      <ol className="flex flex-col">
        {FIRST_STEPS.map((key, i) => {
          const isDone = done[key];
          const open = key === step;
          return (
            <li key={key} className={clsx("border-t border-line-subtle first:border-t-0", open ? "py-5" : "py-2.5")}>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={clsx(
                    "relative grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[12px]",
                    open ? "border-ink bg-ink text-background" : "border-line text-ink-2",
                  )}
                >
                  {isDone ? (
                    <svg viewBox="0 0 44 44" className="size-6 stroke-primary" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                      <path d={CHECK} />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {open ? (
                  <h3 className="t-section text-ink">{TITLE[key]}</h3>
                ) : (
                  <p className={clsx("t-ui", isDone ? "text-ink-2" : "text-ink")}>
                    {TITLE[key]}
                    {isDone && <span className="sr-only"> (feito)</span>}
                  </p>
                )}
              </div>

              {open && key === "ficha" && (
                <div className="mt-4 sm:pl-10">
                  <p className="mb-5 max-w-[58ch] t-reading text-ink-2">Três perguntas e a data da prova. Nada aqui é definitivo: dá para mudar depois, em Mais.</p>
                  {ficha ? (
                    <FichaForm defaults={ficha} onSaved={() => finish("ficha", false)} secondary={{ label: "Depois", onClick: () => finish("ficha") }} />
                  ) : (
                    <Button variant="ghost" onClick={() => finish("ficha")}>
                      Depois
                    </Button>
                  )}
                </div>
              )}

              {open && key === "primeira_questao" && (
                <div className="mt-3 sm:pl-10">
                  <p className="max-w-[58ch] t-reading text-ink-2">
                    Uma questão real do Enem, das que a maioria acertou na prova. Depois da sua resposta aparece o Raio-X, a correção comentada.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          setMessage(null);
                          const r = await startFirstQuestion({ actionId: crypto.randomUUID() });
                          if (r.ok) router.push(`/estudar/sessao/${r.sessionId}?primeira=1`);
                          else setMessage(r.message);
                        })
                      }
                    >
                      Responder a primeira questão
                    </Button>
                    <Button variant="ghost" disabled={pending} onClick={() => finish("primeira_questao")}>
                      Pular
                    </Button>
                  </div>
                </div>
              )}

              {open && key === "tour" && (
                <div className="mt-3 sm:pl-10">
                  <p className="max-w-[58ch] t-reading text-ink-2">Seis paradas, uma frase em cada. Você avança quando quiser e pode sair a qualquer momento.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={() => setTouring(true)}>Começar o tour</Button>
                    <Button variant="ghost" disabled={pending} onClick={() => finish("tour")}>
                      Pular
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div aria-live="polite">
        {message && (
          <p role="alert" className="mt-3 t-ui text-ink sm:pl-10">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
