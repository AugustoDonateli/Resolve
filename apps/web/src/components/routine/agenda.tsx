"use client";

import { clsx } from "clsx";
import { GripVertical } from "lucide-react";
import { animate, motion, useMotionValue } from "motion/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import {
  canPlace,
  fmtClock,
  fmtDuration,
  KIND_LABEL,
  SLOT,
  type StudyBlock,
} from "@/lib/demo/routine";
import { KindIcon } from "./kind-icon";

const PPM = 1.6; // pixels por minuto (15 min = 24 px)

interface Props {
  blocks: StudyBlock[];
  gridStart: number;
  gridEnd: number;
  nowMin: number;
  focusedId: string | null;
  onReschedule: (
    id: string,
    start: number,
  ) => { ok: true } | { ok: false; reason: string };
  onOpenReschedule: (id: string) => void;
}

/**
 * Agenda do dia (F1-T07). O bloco responde ao gesto, os espaços possíveis ficam
 * claros e, após soltar, ele se assenta no horário escolhido a partir de onde
 * foi solto. Clique/Enter abre a mesma remarcação por formulário.
 */
export function Agenda({
  blocks,
  gridStart,
  gridEnd,
  nowMin,
  focusedId,
  onReschedule,
  onOpenReschedule,
}: Props) {
  const [drag, setDrag] = useState<{
    id: string;
    slot: number;
    ok: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const height = (gridEnd - gridStart) * PPM;
  const hours: number[] = [];
  for (let m = Math.ceil(gridStart / 60) * 60; m <= gridEnd; m += 60)
    hours.push(m);

  return (
    <section
      aria-labelledby="agenda-title"
      className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5"
    >
      <h2 id="agenda-title" className="t-section">
        Agenda de hoje
      </h2>
      <p className="t-meta text-ink-2">
        Arraste um bloco ou toque nele para remarcar.
      </p>
      <p aria-live="polite" className="mb-3 min-h-5 t-meta text-ink">
        {message}
      </p>
      <div className="relative" style={{ height }}>
        {hours.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 flex items-start gap-3"
            style={{ top: (m - gridStart) * PPM }}
          >
            <span
              className={clsx(
                "-mt-2.5 w-11 shrink-0 t-meta tabular text-ink-2",
                Math.abs(nowMin - m) < 14 && "invisible",
              )}
            >
              {fmtClock(m)}
            </span>
            <span className="h-px flex-1 bg-line-subtle" />
          </div>
        ))}

        {/* Espaço de destino durante o arraste */}
        {drag && (
          <div
            aria-hidden="true"
            className={clsx(
              "absolute left-14 right-0 rounded-card border-2 border-dashed",
              drag.ok ? "border-primary bg-primary/5" : "border-ink/50",
            )}
            style={{
              top: (drag.slot - gridStart) * PPM,
              height:
                (blocks.find((b) => b.id === drag.id)?.minutes ?? 0) * PPM,
            }}
          >
            <span className="absolute -top-6 right-0 rounded-control bg-surface px-1.5 t-meta tabular text-ink">
              {fmtClock(drag.slot)} {drag.ok ? "" : "· ocupado"}
            </span>
          </div>
        )}

        {/* Linha de agora */}
        {nowMin >= gridStart && nowMin <= gridEnd && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: (nowMin - gridStart) * PPM }}
          >
            <span className="w-11 shrink-0 text-right t-meta font-medium tabular text-link">
              {fmtClock(nowMin)}
            </span>
            <span className="ml-3 size-2 rounded-full bg-link" />
            <span className="h-0.5 flex-1 bg-link" />
          </div>
        )}

        {blocks.map((b) => (
          <AgendaBlock
            key={b.id}
            block={b}
            gridStart={gridStart}
            gridEnd={gridEnd}
            hidden={b.id === focusedId}
            onDragSlot={(slot) =>
              setDrag(
                slot === null
                  ? null
                  : {
                      id: b.id,
                      slot,
                      ok: canPlace(blocks, b.id, slot, gridStart, gridEnd).ok,
                    },
              )
            }
            onDrop={(slot) => {
              setDrag(null);
              if (slot === b.start) return true;
              const r = onReschedule(b.id, slot);
              setMessage(
                r.ok
                  ? `${b.title} remarcado para ${fmtClock(slot)}.`
                  : r.reason,
              );
              return r.ok;
            }}
            onActivate={() => onOpenReschedule(b.id)}
          />
        ))}
      </div>
    </section>
  );
}

function AgendaBlock({
  block,
  gridStart,
  gridEnd,
  hidden,
  onDragSlot,
  onDrop,
  onActivate,
}: {
  block: StudyBlock;
  gridStart: number;
  gridEnd: number;
  hidden: boolean;
  onDragSlot: (slot: number | null) => void;
  onDrop: (slot: number) => boolean;
  onActivate: () => void;
}) {
  const reduced = useReduced();
  const top = (block.start - gridStart) * PPM;
  const h = block.minutes * PPM;
  const y = useMotionValue(0);
  const prevTop = useRef(top);
  const dragState = useRef<{
    startY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const justDragged = useRef(false);

  // Assentamento: quando o horário muda, parte da posição visual anterior até o novo lugar.
  useLayoutEffect(() => {
    if (prevTop.current !== top) {
      const visual = prevTop.current + y.get();
      y.set(visual - top);
      animate(y, 0, {
        duration: reduced ? 0 : duration.layout / 1000,
        ease: ease.layout,
      });
      prevTop.current = top;
    }
  }, [top, y, reduced]);

  const slotFor = (dy: number) => {
    const raw = gridStart + (top + dy) / PPM;
    const s = Math.round(raw / SLOT) * SLOT;
    return Math.min(Math.max(s, gridStart), gridEnd - block.minutes);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (block.fixed || e.button !== 0) return;
    dragState.current = {
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragState.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) > 5) {
      d.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(d.pointerId);
    }
    if (d.moved) {
      y.set(dy);
      onDragSlot(slotFor(dy));
    }
  };
  const onPointerUp = () => {
    const d = dragState.current;
    dragState.current = null;
    if (!d?.moved) return;
    justDragged.current = true;
    setDragging(false);
    const dy = y.get();
    const ok = onDrop(slotFor(dy));
    if (!ok)
      animate(y, 0, {
        duration: reduced ? 0 : duration.layout / 1000,
        ease: ease.layout,
      });
  };

  return (
    <motion.button
      type="button"
      data-block={block.id}
      onClick={() => {
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        if (!block.fixed) onActivate();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-disabled={block.fixed || undefined}
      style={{ top, height: h, y, touchAction: block.fixed ? "auto" : "none" }}
      className={clsx(
        "absolute left-14 right-0 flex overflow-hidden rounded-card border text-left",
        "transition-[box-shadow,opacity,border-color] duration-[var(--rs-dur-press)]",
        block.fixed
          ? "cursor-default border-line-subtle bg-surface-subtle text-ink-2"
          : "cursor-grab border-line bg-surface text-ink hover:border-ink active:cursor-grabbing",
        dragging && "z-20 shadow-paper ring-2 ring-primary",
        hidden && "opacity-0",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "w-1 shrink-0",
          block.fixed ? "bg-line-subtle" : "bg-primary",
        )}
      />
      <span
        className={clsx(
          "flex min-w-0 flex-1 items-start gap-2 px-2.5",
          h < 52 ? "py-0.5" : "py-1.5",
        )}
      >
        <KindIcon kind={block.kind} className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium leading-5">
            {block.title}
          </span>
          {/* Nome acessível = texto visível + complemento só para leitor de tela (WCAG 2.5.3). */}
          <span
            className={clsx(
              "block truncate t-meta tabular text-ink-2",
              h < 52 && "sr-only",
            )}
          >
            {" "}
            {fmtClock(block.start)}–{fmtClock(block.start + block.minutes)} ·{" "}
            {fmtDuration(block.minutes)}
          </span>
          <span className="sr-only">
            , {KIND_LABEL[block.kind]}
            {block.fixed ? ", compromisso fixo" : ". Ativar para remarcar"}
          </span>
        </span>
        {!block.fixed && (
          <GripVertical
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-ink-2"
          />
        )}
      </span>
    </motion.button>
  );
}
