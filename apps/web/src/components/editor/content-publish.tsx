"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import type { ContentQueueRow } from "@/lib/editor/data";
import { publishConferredContent } from "@/lib/editor/publish-actions";

const CHECKLIST: [string, string][] = [
  ["texto_conferido", "Texto conferido contra o PDF"],
  ["sinais_e_formulas", "Sinais, números e fórmulas conferidos"],
  ["ordem_das_alternativas", "Ordem e letras das alternativas conferidas"],
  ["figuras_sem_corte", "Nenhuma figura com informação cortada"],
  ["texto_alternativo_sem_resposta", "Texto alternativo não revela a resposta"],
  ["gabarito_oficial", "Gabarito conferido contra o oficial"],
  ["fonte_registrada", "Fonte e caderno registrados"],
];
const AREA: Record<string, string> = { LC: "Linguagens", CH: "Humanas", CN: "Natureza", MT: "Matemática" };

/**
 * Publicação de conteúdo conferido: questões oficiais sem impedimento de conteúdo entram no banco com as
 * etiquetas editoriais pendentes. Lotes de até 50, enviados em sequência; cada lote é tudo ou nada.
 */
export function ContentPublish({ rows }: { rows: ContentQueueRow[] }) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("Enem 2025 · conteúdo conferido por Guto contra os PDFs; etiquetas editoriais pendentes");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const ready = useMemo(() => rows.filter((r) => r.blockers.length === 0), [rows]);
  const published = rows.filter((r) => r.blockers.includes("já publicada")).length;
  const blocked = rows.filter((r) => r.blockers.length > 0 && !r.blockers.includes("já publicada"));
  const byArea = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of ready) m.set(r.area ?? "?", (m.get(r.area ?? "?") ?? 0) + 1);
    return [...m.entries()];
  }, [ready]);
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of blocked) for (const b of r.blockers) m.set(b, (m.get(b) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [blocked]);
  const allChecked = CHECKLIST.every(([k]) => checks[k]);

  const publish = () =>
    start(async () => {
      setMsg(null);
      const ids = ready.map((r) => r.proposal_id);
      let done = 0;
      for (let i = 0; i < ids.length; i += 50) {
        const r = await publishConferredContent({ ids: ids.slice(i, i + 50), note, checklist: checks });
        if (!r.ok) {
          setMsg({ ok: false, text: `${done} publicada(s). ${r.message}` });
          router.refresh();
          return;
        }
        done += r.published;
      }
      setMsg({ ok: true, text: `${done} questão(ões) publicada(s) com etiquetas pendentes.` });
      router.refresh();
    });

  return (
    <section aria-labelledby="conteudo-conferido" className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface p-5 shadow-paper sm:p-7">
      <div>
        <h2 id="conteudo-conferido" className="t-section">
          Conteúdo conferido, etiquetas pendentes
        </h2>
        <p className="mt-1 max-w-2xl t-meta text-ink-2">
          Publica no banco de estudo o enunciado, as alternativas, as figuras, o gabarito oficial e a fonte. Habilidade, análise dos
          distratores, evidências e resolução ficam marcadas como pendentes e aparecem como indisponíveis no Raio-X até a revisão das
          etiquetas. Propostas com dúvida aberta não entram.
        </p>
      </div>
      <p className="t-ui" role="status">
        <span className="font-display text-[28px] tabular">{ready.length}</span> prontas
        {byArea.length > 0 && (
          <span className="t-meta text-ink-2"> · {byArea.map(([a, n]) => `${AREA[a] ?? a} ${n}`).join(" · ")}</span>
        )}
        <span className="t-meta text-ink-2"> · {published} já publicada(s) · {blocked.length} com impedimento</span>
      </p>
      {reasons.length > 0 && (
        <details className="t-meta text-ink-2">
          <summary className="cursor-pointer t-ui text-ink">Por que {blocked.length} não entram</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {reasons.map(([b, n]) => (
              <li key={b}>
                {n} × {b}
              </li>
            ))}
          </ul>
        </details>
      )}
      {ready.length > 0 && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 t-ui font-semibold">Checklist do conteúdo (vale para todo o lote)</legend>
            {CHECKLIST.map(([k, label]) => (
              <label key={k} className="flex min-h-11 items-center gap-3 t-ui">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--rs-primary)]"
                  checked={!!checks[k]}
                  onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <TextArea label="Nota do lote" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          <Button type="button" className="self-start" disabled={!allChecked} loading={pending} onClick={publish}>
            Publicar {ready.length} questões
          </Button>
        </>
      )}
      <div aria-live="polite">
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="t-ui">
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
