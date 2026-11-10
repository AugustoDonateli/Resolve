"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SHEET_PROFILE, wrapLines } from "@/lib/essay/sheet";

/**
 * Folha simulada (F5-T06): contagem pelo perfil fixo `folha-v1` e prévia ampliável, linha a linha,
 * com as mesmas quebras em qualquer tela. A explicação diz o que a contagem é e o que ela não é.
 */
export function SheetPreview({ text }: { text: string }) {
  const lines = wrapLines(text);
  const over = Math.max(0, lines.length - SHEET_PROFILE.lineLimit);
  const [size, setSize] = useState(14);
  const rows = Math.max(SHEET_PROFILE.lineLimit, lines.length);
  return (
    <div className="flex flex-col gap-2">
      <p className="t-meta" aria-live="polite">
        Folha simulada: {lines.length} de {SHEET_PROFILE.lineLimit} linhas
        {over > 0
          ? ` — passou ${over} ${over === 1 ? "linha" : "linhas"} do limite.`
          : "."}
      </p>
      <p className="max-w-2xl t-meta text-ink-2">
        Regra da plataforma ({SHEET_PROFILE.version}): até{" "}
        {SHEET_PROFILE.columns} caracteres por linha, recuo no início de cada
        parágrafo e quebra por palavra. A contagem é a mesma no computador e no
        celular, mas é uma simulação: não prevê quantas linhas a sua letra ocupa
        na folha de papel.
      </p>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
          >
            Ver a folha
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--rs-scrim)]" />
          <Dialog.Content className="fixed inset-2 z-50 flex flex-col gap-3 overflow-hidden rounded-panel border border-line-subtle bg-surface p-3 shadow-paper outline-none sm:inset-6 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Dialog.Title className="t-ui font-semibold">
                Folha simulada ({lines.length} de {SHEET_PROFILE.lineLimit}{" "}
                linhas)
              </Dialog.Title>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Diminuir a folha"
                  onClick={() => setSize((s) => Math.max(9, s - 2))}
                  className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Ampliar a folha"
                  onClick={() => setSize((s) => Math.min(24, s + 2))}
                  className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink"
                  >
                    <X aria-hidden="true" className="size-5" />
                    <span className="sr-only">Fechar</span>
                  </button>
                </Dialog.Close>
              </div>
            </div>
            <Dialog.Description className="sr-only">
              Prévia linha a linha da folha simulada; use os botões para
              ampliar.
            </Dialog.Description>
            <div role="region" aria-label="Linhas da folha" tabIndex={0} className="min-h-0 flex-1 overflow-auto rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">
              <ol
                className="font-mono"
                style={{
                  fontSize: size,
                  lineHeight: 1.9,
                  width: `calc(${SHEET_PROFILE.columns}ch + 4ch)`,
                }}
              >
                {Array.from({ length: rows }, (_, i) => (
                  <li
                    key={i}
                    className={
                      i >= SHEET_PROFILE.lineLimit
                        ? "flex border-b border-ink"
                        : "flex border-b border-line-subtle"
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="w-[4ch] shrink-0 pr-[1ch] text-right text-ink-2"
                    >
                      {i + 1}
                    </span>
                    <span className="whitespace-pre">
                      {lines[i]?.text ?? ""}
                    </span>
                    {i >= SHEET_PROFILE.lineLimit && (
                      <span className="sr-only"> (além do limite)</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
