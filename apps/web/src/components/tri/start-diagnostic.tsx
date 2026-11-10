"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startDiagnostic } from "@/lib/study/actions";

export function StartDiagnostic({ area, label, available }: { area: "LC" | "CH" | "CN" | "MT"; label: string; available: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [actionId] = useState(() => crypto.randomUUID());
  if (available === 0) return <p className="t-meta text-ink-2">Ainda não há questões publicadas de {label}.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await startDiagnostic({ actionId, area });
            if (!r.ok) return setMsg(r.error === "resolve_no_items" ? "Sem questões disponíveis." : "Não foi possível abrir agora.");
            router.push(`/estudar/sessao/${r.value}`);
          })
        }
      >
        Diagnóstico de {label} ({Math.min(20, available)} questões)
      </Button>
      <span aria-live="polite" className="t-meta">{msg}</span>
    </div>
  );
}
