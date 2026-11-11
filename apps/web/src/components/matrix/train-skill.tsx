"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startSkillTraining } from "@/lib/study/actions";

export function TrainSkill({ skillId, available }: { skillId: string; available: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="self-start"
        disabled={available === 0}
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startSkillTraining({ actionId: crypto.randomUUID(), skillId });
            if (r.ok) router.push(`/estudar/sessao/${r.value}`);
            else setError(r.error === "resolve_no_items" ? "Não há questões publicadas com esta habilidade." : "Não foi possível começar. Tente de novo.");
          })
        }
      >
        {available > 0 ? `Treinar esta habilidade (${Math.min(available, 10)} questões)` : "Treinar esta habilidade"}
      </Button>
      {available === 0 && <p className="t-meta text-ink-2">Ainda não há questões publicadas com esta habilidade revisada.</p>}
      {error && <p role="alert" className="t-meta">{error}</p>}
    </div>
  );
}
