"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reportProblem } from "@/lib/study/report-actions";
import { REPORT_KINDS } from "@/lib/study/report-kinds";

/** Relato de problema numa questão (F3-T17): fica ligado à versão exata; nada muda sem revisão. */
export function ReportProblem({
  itemVersionId,
  sessionItemId,
}: {
  itemVersionId: string;
  sessionItemId: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("texto_diferente_da_prova");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  if (result?.ok) {
    return (
      <p role="status" className="t-meta text-ink-2">
        {result.text}
      </p>
    );
  }
  return open ? (
    <form
      aria-label="Informar problema na questão"
      className="flex max-w-xl flex-col gap-3 rounded-card border border-line-subtle bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        const r = await reportProblem({
          itemVersionId,
          sessionItemId,
          kind,
          message,
        });
        setSending(false);
        setResult(
          r.ok
            ? {
                ok: true,
                text: "Relato enviado. A equipe editorial confere antes de mudar qualquer coisa.",
              }
            : { ok: false, text: r.message },
        );
      }}
    >
      <label className="flex min-w-0 flex-col gap-1.5 t-ui">
        Tipo de problema
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink"
        >
          {REPORT_KINDS.map((k) => (
            <option key={k.code} value={k.code}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 t-ui">
        O que você viu?
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          className="rounded-control border border-line bg-surface px-3 py-2 t-ui text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" loading={sending}>
          Enviar relato
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>
      <div aria-live="polite">
        {result && !result.ok && (
          <p role="alert" className="t-ui">
            {result.text}
          </p>
        )}
      </div>
    </form>
  ) : (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="self-start"
      onClick={() => setOpen(true)}
    >
      Informar problema nesta questão
    </Button>
  );
}
