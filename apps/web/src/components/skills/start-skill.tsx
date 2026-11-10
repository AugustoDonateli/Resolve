"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startSkill } from "@/lib/study/actions";

const AREAS = [
  ["todas", "Todas as áreas"],
  ["LC", "Linguagens"],
  ["CH", "Ciências Humanas"],
  ["CN", "Ciências da Natureza"],
  ["MT", "Matemática"],
] as const;

export function StartSkill({ skill, available }: { skill: "comando" | "distrator"; available: number }) {
  const router = useRouter();
  const [area, setArea] = useState<(typeof AREAS)[number][0]>("todas");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [actionId] = useState(() => crypto.randomUUID());
  return (
    <div className="flex flex-col gap-4">
      {available > 0 ? (
        <>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 t-ui">Área</legend>
            {AREAS.map(([k, label]) => (
              <label
                key={k}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-control border px-3 t-meta ${area === k ? "border-ink bg-surface text-ink" : "border-line-subtle text-ink-2 hover:border-line"}`}
              >
                <input type="radio" name="area" className="sr-only" checked={area === k} onChange={() => setArea(k)} />
                {label}
              </label>
            ))}
          </fieldset>
          <Button
            type="button"
            className="self-start"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await startSkill({ actionId, skill, area });
                if (!r.ok) return setMsg(r.error === "resolve_no_items" ? "Sem questões disponíveis nessa área." : "Não foi possível começar agora.");
                router.push(`/estudar/${skill}/${r.value}`);
              })
            }
          >
            Começar com 5 questões
          </Button>
        </>
      ) : (
        <p className="t-reading text-ink-2">Ainda não há questões publicadas para este treino.</p>
      )}
      <Link href={`/estudar/${skill}/demonstracao`} className="inline-flex min-h-11 items-center self-start t-ui text-link underline">
        Experimentar com a questão demonstrativa
      </Link>
      <p aria-live="polite" className="t-meta">{msg}</p>
    </div>
  );
}
