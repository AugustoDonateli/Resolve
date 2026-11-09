"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import type { QueueRow } from "@/lib/editor/data";
import { textProblem } from "@/lib/editor/payload";
import { publishProposals, type PublishResult } from "@/lib/editor/publish-actions";

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;

export function PublishQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [pending, start] = useTransition();
  const [showBlocked, setShowBlocked] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { notes: string | null; publishable: boolean; rows: QueueRow[] }>();
    for (const r of rows) {
      if (r.status === "promovida" || r.status === "rejeitada") continue;
      const g = map.get(r.batch_id) ?? { notes: r.batch_notes, publishable: r.publishable, rows: [] };
      g.rows.push(r);
      map.set(r.batch_id, g);
    }
    return [...map.entries()];
  }, [rows]);
  const ready = rows.filter((r) => r.status === "valida" && r.blockers.length === 0);
  const published = rows.filter((r) => r.status === "promovida").length;
  const rejected = rows.filter((r) => r.status === "rejeitada").length;

  return (
    <div className="flex flex-col gap-6">
      <p className="t-ui" role="status">
        {ready.length} pronta(s) para publicar · {published} já publicada(s) · {rejected} rejeitada(s)
      </p>

      {ready.length > 0 && (
        <section aria-labelledby="prontas" className="rounded-panel border border-line bg-surface p-4 sm:p-6">
          <h2 id="prontas" className="mb-3 t-section">
            Prontas
          </h2>
          <ul className="flex flex-col">
            {ready.map((r) => (
              <li key={r.proposal_id}>
                <label className="flex min-h-11 items-center gap-3 t-ui">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--rs-primary)]"
                    checked={selected.includes(r.proposal_id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.proposal_id] : s.filter((x) => x !== r.proposal_id)))}
                  />
                  Questão {r.question_number}
                  {r.foreign_language ? ` (${LANG[r.foreign_language]})` : ""} · {r.batch_notes}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-4">
            <TextArea label="Descrição do lote publicado" value={note} rows={2} error={textProblem(note) ?? undefined} onChange={(e) => setNote(e.target.value)} />
            {!confirming ? (
              <Button type="button" className="self-start" disabled={selected.length === 0 || note.trim().length < 3} onClick={() => setConfirming(true)}>
                Publicar {selected.length} questão(ões)
              </Button>
            ) : (
              <div role="alertdialog" aria-labelledby="confirma-titulo" className="flex flex-col gap-3 rounded-card border border-ink p-4">
                <p id="confirma-titulo" className="t-ui">
                  Publicar {selected.length} questão(ões)? Publicado não se desfaz: correções futuras criam nova versão.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await publishProposals({ ids: selected, note });
                        setResult(r);
                        setConfirming(false);
                        if (r.ok) {
                          setSelected([]);
                          setNote("");
                          router.refresh();
                        }
                      })
                    }
                  >
                    Confirmar publicação
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <div aria-live="polite">
        {result?.ok === true && (
          <p className="flex items-center gap-2 t-ui">
            <CheckCircle2 aria-hidden="true" className="size-5" /> {result.published} questão(ões) publicada(s).
          </p>
        )}
        {result?.ok === false && <p className="t-ui">{result.message}</p>}
      </div>

      <section aria-labelledby="impedidas">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="impedidas" className="t-section">
            Ainda não podem ser publicadas
          </h2>
          <Button type="button" variant="secondary" size="sm" aria-expanded={showBlocked} onClick={() => setShowBlocked((v) => !v)}>
            {showBlocked ? "Ocultar motivos" : "Mostrar motivos"}
          </Button>
        </div>
        <div className="flex flex-col gap-6">
          {groups.map(([id, g]) => {
            const blocked = g.rows.filter((r) => r.blockers.length > 0 || r.status !== "valida");
            return (
              <div key={id} className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
                <h3 className="t-ui">{g.notes ?? "Lote sem descrição"}</h3>
                <p className="mb-2 t-meta text-ink-2">
                  {g.publishable ? `${blocked.length} com impedimento` : "Lote de teste: nunca é publicado."}
                </p>
                {showBlocked && (
                  <ul className="flex flex-col gap-2">
                    {blocked.map((r) => (
                      <li key={r.proposal_id} className="t-meta">
                        <Link href={`/editor/proposta/${r.proposal_id}/etiquetas`} className="t-ui text-link underline underline-offset-4">
                          Questão {r.question_number}
                          {r.foreign_language ? ` (${LANG[r.foreign_language]})` : ""}
                        </Link>
                        <span className="text-ink-2">: {r.blockers.join("; ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
