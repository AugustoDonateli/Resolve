"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createEssay } from "@/lib/essay/draft-actions";

const noop = () => () => {};

export function NewEssayButton({
  promptId = null,
  label = "Nova redação",
}: {
  promptId?: string | null;
  label?: string;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="self-start"
        loading={pending}
        disabled={!hydrated}
        onClick={() =>
          start(async () => {
            const r = await createEssay({ promptId });
            if (r.ok) router.push(`/redacao/escrever/${r.essayId}`);
            else setError(r.error);
          })
        }
      >
        {label}
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
