"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resetGuide } from "@/lib/guide/actions";
import type { FichaDefaults } from "@/lib/guide/types";
import { FichaForm } from "./ficha-form";

/** Rever o tutorial: os primeiros passos voltam para a mesa e as dicas da primeira vez reaparecem. */
export function RestartGuide() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await resetGuide();
              if (r.ok) router.push("/hoje");
              else setMessage(r.message);
            })
          }
        >
          Recomeçar o tutorial
        </Button>
        <Link href="/hoje?tour=1" className="inline-flex min-h-11 items-center rounded-control px-3 t-ui text-ink hover:bg-surface-subtle">
          Só o tour da mesa
        </Link>
      </div>
      <div aria-live="polite">
        {message && (
          <p role="alert" className="t-meta text-ink">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Ficha de identificação fora dos primeiros passos: mesma ficha, para corrigir as respostas depois. */
export function FichaEditor({ defaults }: { defaults: FichaDefaults }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <FichaForm
        defaults={defaults}
        submitLabel="Guardar"
        onSaved={() => {
          setSaved(true);
          router.refresh();
        }}
      />
      <div aria-live="polite">
        {saved && (
          <p role="status" className="t-ui text-ink">
            Ficha guardada.
          </p>
        )}
      </div>
    </div>
  );
}
