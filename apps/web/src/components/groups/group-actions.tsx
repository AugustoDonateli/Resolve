"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createDuel, leaveGroup, startDuel } from "@/lib/groups/actions";
import { AREA_LABEL } from "@/lib/study/question-types";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-control border border-dashed border-line bg-surface px-4 py-2 font-mono text-[22px] tracking-[0.25em] text-ink">{code}</span>
      <Button
        type="button"
        variant="ghost"
        icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            /* sem área de transferência: o código está visível para copiar à mão */
          }
        }}
      >
        {copied ? "Copiado" : "Copiar código"}
      </Button>
    </div>
  );
}

export function NewDuel({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [area, setArea] = useState("todas");
  const [count, setCount] = useState("5");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Novo duelo"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await createDuel({ groupId, area, count: Number(count) });
          if (r.ok) router.push(`/grupos/duelo/${r.value}`);
          else setError(r.message);
        });
      }}
    >
      <label className="flex flex-col gap-1 t-meta text-ink-2">
        Área
        <select value={area} onChange={(e) => setArea(e.target.value)} className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink">
          <option value="todas">Todas</option>
          {Object.entries(AREA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 t-meta text-ink-2">
        Questões
        <select value={count} onChange={(e) => setCount(e.target.value)} className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink">
          <option value="5">5</option>
          <option value="10">10</option>
        </select>
      </label>
      <Button type="submit" loading={pending}>
        Lançar duelo
      </Button>
      <div aria-live="polite" className="w-full">
        {error && <p role="alert" className="t-meta">{error}</p>}
      </div>
    </form>
  );
}

export function PlayDuel({ duelId, label }: { duelId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        loading={pending}
        className="self-start"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startDuel({ duelId, actionId: crypto.randomUUID() });
            if (r.ok) router.push(`/estudar/sessao/${r.value}`);
            else setError(r.message);
          })
        }
      >
        {label}
      </Button>
      {error && <p role="alert" className="t-meta">{error}</p>}
    </div>
  );
}

export function LeaveGroup({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <Button type="button" variant="ghost" className="self-start" onClick={() => setConfirm(true)}>
        Sair do grupo
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="t-meta text-ink-2">Seus duelos ficam no histórico. Para voltar, use o código.</span>
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await leaveGroup({ groupId });
            if (r.ok) router.push("/grupos");
          })
        }
      >
        Confirmar saída
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
        Cancelar
      </Button>
    </div>
  );
}
