"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { handleReport } from "@/lib/study/report-actions";
import { REPORT_KINDS } from "@/lib/study/report-kinds";

export interface ReportRow {
  id: string;
  item_version_id: string;
  kind: string;
  message: string;
  status: "aberta" | "em_analise" | "resolvida" | "descartada";
  editor_note: string | null;
  created_at: string;
  handled_at: string | null;
  where: string;
}

const STATUS = {
  aberta: "Aberta",
  em_analise: "Em análise",
  resolvida: "Resolvida",
  descartada: "Descartada",
} as const;
const kindLabel = (k: string) =>
  REPORT_KINDS.find((x) => x.code === k)?.label ?? k;

export function ReportQueue({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return <p className="t-ui">Nenhuma ocorrência relatada.</p>;
  const open = rows.filter(
    (r) => r.status === "aberta" || r.status === "em_analise",
  );
  const closed = rows.filter((r) => !open.includes(r));
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="abertas">
        <h2 id="abertas" className="mb-3 t-section">
          Abertas ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="t-ui">Nenhuma aberta.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
      {closed.length > 0 && (
        <section aria-labelledby="fechadas">
          <h2 id="fechadas" className="mb-3 t-section">
            Fechadas ({closed.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {closed.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Item({ r }: { r: ReportRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(r.editor_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const act = (status: "em_analise" | "resolvida" | "descartada") =>
    start(async () => {
      setError(null);
      const res = await handleReport({ id: r.id, status, note });
      if (res.ok) router.refresh();
      else setError(res.message);
    });
  const isOpen = r.status === "aberta" || r.status === "em_analise";
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface p-4">
      <p className="t-meta text-ink-2">
        {STATUS[r.status]} · {kindLabel(r.kind)} · {r.where} ·{" "}
        {new Date(r.created_at).toLocaleDateString("pt-BR")}
      </p>
      <p className="t-reading">{r.message}</p>
      {isOpen ? (
        <>
          <label className="flex flex-col gap-1.5 t-ui">
            Nota do editor
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              className="rounded-control border border-line bg-surface px-3 py-2 t-ui text-ink"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {r.status === "aberta" && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => act("em_analise")}
              >
                Em análise
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              loading={pending}
              onClick={() => act("resolvida")}
            >
              Resolvida
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => act("descartada")}
            >
              Descartar
            </Button>
          </div>
        </>
      ) : (
        r.editor_note && <p className="t-meta">Nota: {r.editor_note}</p>
      )}
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
