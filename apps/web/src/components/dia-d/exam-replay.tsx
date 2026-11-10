"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clockLabel, type ExamRun, type ExamEvent } from "@/lib/dia-d/types";

const BLOCK_SIZE = 15;

function describe(event: ExamEvent) {
  if (event.kind === "abriu") return "Abriu a questão";
  if (event.kind === "marcou") return event.letter ? `Marcou ${event.letter} no caderno` : "Limpou a marcação";
  if (event.kind === "transcreveu") return event.letter ? `Transcreveu ${event.letter} no cartão` : "Limpou o cartão";
  if (event.kind === "redacao") return "Salvou a redação";
  return "Entregou o simulado";
}

export function ExamReplay({ run, open }: { run: ExamRun; open: (position: number) => void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const start = Date.parse(run.started_at);
  const length = Math.max(1, Date.parse(run.ended_at!) - start);
  const scale = Math.max(1, length / 30_000);
  const events = run.events.map((event) => ({ event, at: Date.parse(event.recorded_at) - start }));
  const current = events.findLast(({ at }) => at <= time)?.event;
  const last = time >= length;
  const finalCards = new Map(run.items.flatMap((item) =>
    item.correct && item.card ? [[item.position, item] as const] : [],
  ));
  const chronology = new Map<number, number>();
  for (const { event, at } of events) {
    if (event.kind === "transcreveu" && event.position !== null && finalCards.has(event.position)) {
      chronology.set(event.position, at);
    }
  }
  const ordered = [...chronology].sort((a, b) => a[1] - b[1]);
  const blocks = Array.from({ length: Math.ceil(ordered.length / BLOCK_SIZE) }, (_, index) => {
    const first = index * BLOCK_SIZE;
    const rows = ordered.slice(first, first + BLOCK_SIZE);
    return {
      first: first + 1,
      last: first + rows.length,
      total: rows.length,
      correct: rows.filter(([position]) => finalCards.get(position)!.card === finalCards.get(position)!.correct).length,
      elapsed: rows.at(-1)![1] - (ordered[first - 1]?.[1] ?? 0),
    };
  });

  useEffect(() => {
    if (!playing || last) return;
    let previous = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const step = (now - previous) * scale;
      previous = now;
      setTime((position) => Math.min(length, position + step));
    }, 80);
    return () => window.clearInterval(id);
  }, [playing, last, length, scale]);

  return (
    <section className="max-w-3xl" aria-labelledby="dia-d-replay">
      <h2 id="dia-d-replay" className="t-section">Replay da prova</h2>
      <p className="my-3 t-meta text-ink-2">
        A linha usa o horário registrado pelo servidor. Um segundo de replay equivale a {Math.round(scale)} segundos de prova.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => { if (last) setTime(0); setPlaying(last || !playing); }}>
          {last ? "Rever replay" : playing ? "Pausar" : "Reproduzir"}
        </Button>
        <output className="t-meta tabular">{clockLabel(time)} / {clockLabel(length)}</output>
        <input
          type="range" aria-label="Tempo na prova" min={0} max={length} value={time}
          className="w-full max-w-md accent-primary"
          onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }}
        />
      </div>
      <p className="mb-4 t-ui">
        {current ? `${current.position ? `Questão ${current.position} · ` : ""}${describe(current)}` : "Início da prova"}
      </p>
      <details>
        <summary className="min-h-11 cursor-pointer t-ui">Ver eventos registrados ({events.length})</summary>
        <table className="w-full text-left t-meta">
          <thead className="border-b border-line"><tr><th scope="col">Tempo</th><th scope="col">Evento</th><th scope="col">Questão</th></tr></thead>
          <tbody className="divide-y divide-line-subtle">
            {events.map(({ event, at }) => (
              <tr key={event.sequence}>
                <td className="tabular">
                  <button className="min-h-11 underline" onClick={() => { setPlaying(false); setTime(at); }}>{clockLabel(at)}</button>
                </td>
                <td>{describe(event)}</td>
                <td>
                  {event.position === null ? "—" : <button className="min-h-11 underline" onClick={() => open(event.position!)}>Questão {event.position}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="mt-6">
        <h3 className="t-section">Acertos ao longo da prova</h3>
        {blocks.length ? (
          <>
            <p className="my-2 t-meta text-ink-2">
              Blocos de até {BLOCK_SIZE} respostas válidas, na ordem da última transcrição. O tempo mede o intervalo no relógio, incluindo pausas e voltas entre questões.
            </p>
            <table className="w-full max-w-xl text-left t-meta">
              <thead className="border-b border-line"><tr><th scope="col">Respostas</th><th scope="col">Acertos</th><th scope="col">Intervalo</th></tr></thead>
              <tbody className="divide-y divide-line-subtle">
                {blocks.map((block) => (
                  <tr key={block.first}>
                    <th scope="row" className="py-2 font-medium">{block.first === block.last ? block.first : `${block.first}–${block.last}`}</th>
                    <td>{block.correct}/{block.total}</td>
                    <td className="tabular">{clockLabel(block.elapsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <p className="mt-2 t-meta text-ink-2">Nenhuma resposta válida foi transcrita.</p>}
      </div>
    </section>
  );
}
