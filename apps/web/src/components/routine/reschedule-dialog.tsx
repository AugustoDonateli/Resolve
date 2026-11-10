"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtClock, freeSlots, type StudyBlock } from "@/lib/demo/routine";

interface Props {
  block: StudyBlock | null;
  blocks: StudyBlock[];
  gridStart: number;
  gridEnd: number;
  onClose: () => void;
  onConfirm: (id: string, start: number) => void;
}

/** Remarcação por formulário: mesmo resultado do gesto (F1-T07, F4-T16). */
export function RescheduleDialog({
  block,
  blocks,
  gridStart,
  gridEnd,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={block !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--rs-scrim)] data-[state=open]:animate-[fade-in_var(--rs-dur-state)_var(--rs-ease-state)]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-auto rounded-t-panel border border-line-subtle bg-surface p-5 shadow-paper outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel"
          aria-describedby="reschedule-desc"
        >
          {block && (
            <Body
              key={block.id}
              block={block}
              blocks={blocks}
              gridStart={gridStart}
              gridEnd={gridEnd}
              onConfirm={onConfirm}
            />
          )}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Fechar"
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({
  block,
  blocks,
  gridStart,
  gridEnd,
  onConfirm,
}: {
  block: StudyBlock;
  blocks: StudyBlock[];
  gridStart: number;
  gridEnd: number;
  onConfirm: (id: string, start: number) => void;
}) {
  const slots = freeSlots(blocks, block.id, gridStart, gridEnd);
  const [choice, setChoice] = useState<number>(block.start);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(block.id, choice);
      }}
    >
      <Dialog.Title className="t-section pr-10">
        Remarcar “{block.title}”
      </Dialog.Title>
      <Dialog.Description
        id="reschedule-desc"
        className="mt-1 t-meta text-ink-2"
      >
        Horários livres de hoje para {block.minutes} minutos. Compromissos não
        se movem.
      </Dialog.Description>
      <fieldset className="mt-4">
        <legend className="sr-only">Novo horário</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <label
              key={s}
              className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line t-ui tabular has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <input
                type="radio"
                name="slot"
                value={s}
                checked={choice === s}
                onChange={() => setChoice(s)}
                className="sr-only"
              />
              {fmtClock(s)}
            </label>
          ))}
        </div>
        {slots.length === 0 && (
          <p className="t-meta">Não há espaço livre hoje para este bloco.</p>
        )}
      </fieldset>
      <div className="mt-5 flex justify-end gap-2">
        <Dialog.Close asChild>
          <Button variant="ghost" type="button">
            Cancelar
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={choice === block.start}>
          Remarcar para {fmtClock(choice)}
        </Button>
      </div>
    </form>
  );
}
