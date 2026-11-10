"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startWithItems } from "@/lib/study/actions";

const noop = () => () => {};

/** Abre um treino com as questões filtradas (até 30, sorteadas). */
export function ResolveFiltered({ ids }: { ids: string[] }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = Math.min(ids.length, 30);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="self-start"
        loading={pending}
        disabled={!hydrated}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startWithItems({
              actionId: crypto.randomUUID(),
              itemVersionIds: ids,
            });
            if (r.ok) router.push(`/estudar/sessao/${r.value}`);
            else setError("Não foi possível começar. Tente de novo.");
          })
        }
      >
        Resolver{" "}
        {n === ids.length
          ? n === 1
            ? "esta questão"
            : `estas ${n}`
          : `${n} destas (sorteadas)`}
      </Button>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
