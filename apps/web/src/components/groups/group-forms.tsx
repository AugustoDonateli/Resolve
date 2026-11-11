"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createGroup, joinGroup } from "@/lib/groups/actions";

const field = "min-h-11 w-full rounded-control border border-line bg-surface px-3 t-ui text-ink";

function Form({
  title,
  body,
  submit,
  fields,
  onSubmit,
}: {
  title: string;
  body: string;
  submit: string;
  fields: { name: string; label: string; placeholder?: string; upper?: boolean; maxLength: number }[];
  onSubmit: (v: Record<string, string>) => Promise<{ ok: true; value: string } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        start(async () => {
          setError(null);
          const r = await onSubmit(data);
          if (r.ok) router.push(`/grupos/${r.value}`);
          else setError(r.message);
        });
      }}
    >
      <h2 className="t-section">{title}</h2>
      <p className="t-meta text-ink-2">{body}</p>
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 t-meta text-ink-2">
          {f.label}
          <input
            name={f.name}
            required
            minLength={2}
            maxLength={f.maxLength}
            placeholder={f.placeholder}
            autoComplete="off"
            className={f.upper ? `${field} font-mono uppercase tracking-[0.2em]` : field}
          />
        </label>
      ))}
      <Button type="submit" loading={pending} className="self-start">
        {submit}
      </Button>
      <div aria-live="polite">{error && <p role="alert" className="t-meta">{error}</p>}</div>
    </form>
  );
}

export function GroupForms() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Form
        title="Entrar com um código"
        body="Quem criou o grupo vê o código de 8 caracteres na página do grupo."
        submit="Entrar no grupo"
        fields={[
          { name: "code", label: "Código", placeholder: "ABCD2345", upper: true, maxLength: 8 },
          { name: "nickname", label: "Seu apelido no grupo", maxLength: 30 },
        ]}
        onSubmit={(v) => joinGroup({ code: v.code, nickname: v.nickname })}
      />
      <Form
        title="Criar um grupo"
        body="Para estudar com colegas: duelos com as mesmas questões, cada um no seu tempo."
        submit="Criar grupo"
        fields={[
          { name: "name", label: "Nome do grupo", maxLength: 60 },
          { name: "nickname", label: "Seu apelido no grupo", maxLength: 30 },
        ]}
        onSubmit={(v) => createGroup({ name: v.name, nickname: v.nickname })}
      />
    </div>
  );
}
