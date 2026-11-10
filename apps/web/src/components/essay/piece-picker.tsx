"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createEssay } from "@/lib/essay/draft-actions";
import { PIECES, type Piece } from "@/lib/essay/pieces";

const noop = () => () => {};

/** Escolha da peça (quatro modos) e do tema publicado, se houver. */
export function PiecePicker({
  prompts,
}: {
  prompts: { id: string; title: string }[];
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [piece, setPiece] = useState<Piece>("introducao");
  const [promptId, setPromptId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Escolher peça"
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createEssay({
            promptId: promptId || null,
            trainingPiece: piece,
          });
          if (r.ok) router.push(`/redacao/escrever/${r.essayId}`);
          else setError(r.error);
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-ui font-semibold">Peça</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PIECES.map((p) => (
            <label
              key={p.code}
              className="flex cursor-pointer flex-col gap-1 rounded-card border border-line bg-surface p-3 has-[:checked]:border-ink has-[:checked]:bg-surface-subtle has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <span className="flex items-center gap-2 t-ui font-medium">
                <input
                  type="radio"
                  name="peca"
                  value={p.code}
                  checked={piece === p.code}
                  onChange={() => setPiece(p.code)}
                  className="size-4 accent-[var(--rs-text)]"
                />
                {p.label}
                {p.minutes ? (
                  <span className="t-meta text-ink-2">· {p.minutes} min</span>
                ) : null}
              </span>
              <span className="t-meta text-ink-2">{p.guide[0]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-w-0 flex-col gap-1.5 t-ui">
        Tema
        <select
          value={promptId}
          onChange={(e) => setPromptId(e.target.value)}
          className="w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink"
        >
          <option value="">Tema livre</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {prompts.length === 0 && (
          <span className="t-meta text-ink-2">
            Ainda não há tema publicado; dá para treinar com tema livre.
          </span>
        )}
      </label>
      <Button
        type="submit"
        className="self-start"
        loading={pending}
        disabled={!hydrated}
      >
        Começar a peça
      </Button>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
