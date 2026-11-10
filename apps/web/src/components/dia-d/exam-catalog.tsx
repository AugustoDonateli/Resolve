"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { EnvelopeOpening } from "@/components/motion/envelope-opening";
import { Button } from "@/components/ui/button";
import { startDiaD } from "@/lib/dia-d/actions";
import { bookletLabel, canStart, type Booklet, type Catalog } from "@/lib/dia-d/types";

const datetime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function ExamCatalog({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Booklet | null>(null);
  const [reference, setReference] = useState(false);
  const [error, setError] = useState("");
  const [starting, transition] = useTransition();
  const action = useRef("");
  const active = catalog.runs.find((run) => !run.ended_at && Date.parse(run.deadline_at) > Date.parse(catalog.server_time));
  const ready = catalog.booklets.filter(canStart);
  const unavailable = catalog.booklets.filter((book) => !canStart(book));

  function start(book: Booklet) {
    action.current ||= crypto.randomUUID();
    setError("");
    transition(async () => {
      try {
        const result = await startDiaD({
          booklet: book.booklet_id, language: book.language, action: action.current, reference,
        });
        if ("id" in result && result.id) router.push(`/estudar/dia-d/${result.id}`);
        else setError(result.error ?? "Não foi possível iniciar. Tente novamente.");
      } catch {
        setError("A conexão falhou. Tente iniciar novamente para retomar o mesmo simulado.");
      }
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-7">
      {active ? (
        <section className="rounded-panel border border-line-subtle bg-surface p-5">
          <h2 className="t-section">Simulado em andamento</h2>
          <p className="my-3 t-meta text-ink-2">
            Dia {active.day} · Caderno {active.color} · Prazo até {datetime.format(new Date(active.deadline_at))} (Brasília).
          </p>
          <Link className="t-ui underline" href={`/estudar/dia-d/${active.id}`}>Retomar simulado</Link>
        </section>
      ) : selected ? (
        <section aria-label="Abertura do simulado">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="t-section">{bookletLabel(selected)}</h2>
            <Button variant="ghost" disabled={starting} onClick={() => { setSelected(null); setError(""); }}>
              Trocar caderno
            </Button>
          </div>
          <p className="mb-4 t-meta text-ink-2">
            {reference ? "Horário de referência de Brasília" : "Horário livre"} · {selected.expected} questões{selected.essay ? " e redação" : ""}.
          </p>
          <EnvelopeOpening exam={{ day: selected.day, color: selected.color, minutes: selected.minutes, starting, onStart: () => start(selected) }} />
          {error && <p role="alert" className="mt-4 t-ui text-ink">{error}</p>}
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="t-section">{ready.length ? "Escolha seu caderno" : "Nenhum caderno completo disponível"}</h2>
          <p className="max-w-[65ch] t-reading text-ink-2">
            {ready.length
              ? "Separe o tempo de prova. Após começar, o relógio segue correndo, inclusive se você sair ou recarregar a página."
              : "Para liberar um dia de prova, todas as questões daquele caderno precisam estar conferidas e publicadas. O primeiro dia também exige o tema oficial de redação."}
          </p>
          {ready.length > 0 && (
            <ul className="divide-y divide-line-subtle border-y border-line-subtle">
              {ready.map((book) => (
                <li key={`${book.booklet_id}:${book.language}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="t-ui font-semibold">{bookletLabel(book)}</p>
                    <p className="t-meta text-ink-2">{book.minutes} min · {book.expected} questões{book.annulled ? ` (${book.annulled} anuladas)` : ""}{book.essay ? " e redação" : ""}</p>
                    {book.schedule_source && <a className="t-meta underline" href={book.schedule_source} target="_blank" rel="noreferrer">Horário no edital do Inep</a>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => { action.current = ""; setSelected(book); setReference(false); }}>
                      Horário livre
                    </Button>
                    {book.local_start && <Button variant="ghost" onClick={() => { action.current = ""; setSelected(book); setReference(true); }}>
                      Ensaio às {book.local_start.slice(0, 5)}
                    </Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {catalog.runs.some((run) => run.id !== active?.id) && (
        <section aria-labelledby="historico-dia-d">
          <h2 id="historico-dia-d" className="mb-2 t-section">Histórico</h2>
          <ul className="divide-y divide-line-subtle">
            {catalog.runs.filter((run) => run.id !== active?.id).map((run) => (
              <li key={run.id} className="py-2">
                <Link className="inline-flex min-h-11 flex-wrap items-center gap-2 t-ui underline" href={`/estudar/dia-d/${run.id}`}>
                  {run.year} · Dia {run.day} · {run.color}
                  <span className="t-meta text-ink-2">({datetime.format(new Date(run.started_at))})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {unavailable.length > 0 && (
        <details className="border-t border-line-subtle pt-3">
          <summary className="min-h-11 cursor-pointer t-ui">Ver cadernos aguardando publicação</summary>
          <ul className="divide-y divide-line-subtle">
            {unavailable.map((book) => (
              <li key={`${book.booklet_id}:${book.language}`} className="flex flex-wrap justify-between gap-x-3 py-2 t-meta">
                <span>{bookletLabel(book)}</span>
                <span className="text-ink-2">
                  {book.available}/{book.expected - book.annulled} questões válidas publicadas
                  {book.annulled ? ` · ${book.annulled} anuladas` : ""}
                  {book.essay && !book.prompt_id ? " · tema pendente" : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
