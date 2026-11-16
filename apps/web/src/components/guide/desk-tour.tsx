"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { TOUR } from "@/lib/guide/types";

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);

/**
 * Tour da mesa: um objeto destacado por vez, com uma frase. Só começa por pedido, só avança por toque
 * (botão, Enter ou seta), sai a qualquer momento (Pular ou Esc) e nunca anda sozinho. O destaque é uma
 * janela na penumbra; com movimento reduzido ela troca de lugar sem deslizar. A página rola sem animação
 * até o objeto, para a frase e o objeto ficarem à vista juntos.
 */
export function DeskTour({ onDone }: { onDone: () => void }) {
  const reduced = useReduced();
  // Só as paradas cujo objeto está na tela (a agenda, por exemplo, pode não existir em modo local).
  const [steps] = useState(() => TOUR.filter((s) => find(s.target)));
  const [i, setI] = useState(0);
  const spot = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    const el = step ? find(step.target) : null;
    if (!el) return;
    const place = () => {
      const s = spot.current;
      const n = note.current;
      if (!s || !n) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;
      const top = Math.max(6, r.top - pad);
      const left = Math.max(6, r.left - pad);
      const bottom = Math.min(vh - 6, r.bottom + pad);
      const right = Math.min(vw - 6, r.right + pad);
      s.style.top = `${top}px`;
      s.style.left = `${left}px`;
      s.style.width = `${Math.max(0, right - left)}px`;
      s.style.height = `${Math.max(0, bottom - top)}px`;
      if (vw < 640) {
        // Celular: a frase fica presa embaixo; o objeto foi rolado para o alto da tela.
        n.style.top = n.style.left = "";
        return;
      }
      const box = n.getBoundingClientRect();
      const gap = 14;
      let nt = bottom + gap;
      let nl = Math.min(Math.max(12, left), vw - box.width - 12);
      if (nt + box.height > vh - 12) nt = top - gap - box.height;
      if (nt < 12) {
        // Objeto alto demais: a frase vai para o lado em que couber, alinhada ao topo do destaque.
        nt = Math.min(Math.max(12, top), vh - box.height - 12);
        nl = left - gap - box.width >= 12 ? left - gap - box.width : Math.min(right + gap, vw - box.width - 12);
      }
      n.style.top = `${nt}px`;
      n.style.left = `${nl}px`;
    };
    // Traz o objeto para a vista, sem rolagem animada, deixando espaço para a frase.
    const r = el.getBoundingClientRect();
    const small = window.innerWidth < 640;
    const roomBelow = small ? 250 : 40;
    const lead = small ? 72 : 96;
    if (r.top < lead || r.bottom > window.innerHeight - roomBelow) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - lead), behavior: "instant" });
    place();
    // Os objetos chegam à mesa com um giro curto: mede de novo quando assentam.
    const settle = window.setTimeout(place, 750);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [step]);

  // Sem nenhum objeto na tela não há o que mostrar: encerra sem abrir.
  useEffect(() => {
    if (!step) onDone();
  }, [step, onDone]);
  if (!step) return null;

  const last = i === steps.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onDone()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" />
        <div
          ref={spot}
          aria-hidden="true"
          className={clsx(
            "pointer-events-none fixed z-50 rounded-[10px] shadow-[0_0_0_200vmax_var(--rs-scrim)] outline outline-2 outline-offset-0 outline-[var(--rs-on-desk)]",
            !reduced && "transition-[top,left,width,height] duration-[var(--rs-dur-layout)] ease-layout",
          )}
        />
        <Dialog.Content
          ref={note}
          aria-describedby="tour-frase"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
          }}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 rounded-card border border-line-subtle bg-surface p-5 shadow-paper outline-none sm:inset-x-auto sm:bottom-auto sm:w-[22.5rem]"
        >
          <p className="t-kicker">
            Tour da mesa · {i + 1} de {steps.length}
          </p>
          <Dialog.Title className="mt-1 t-section text-ink">{step.title}</Dialog.Title>
          <p id="tour-frase" className="mt-2 t-reading text-ink">
            {step.text}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={onDone}>
              {last ? "Fechar" : "Pular o tour"}
            </Button>
            <div className="flex gap-2">
              {i > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setI(i - 1)}>
                  Voltar
                </Button>
              )}
              <Button size="sm" autoFocus onClick={next}>
                {last ? "Terminar" : "Próximo"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
