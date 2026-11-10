"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordTriage } from "@/lib/study/actions";
import { withSameAction } from "@/lib/study/retry";
import type { SessionEntry, SessionView } from "@/lib/study/session";
import { VisibleTimer } from "@/lib/study/visible-timer";
import { QuestionView } from "./question-view";

const WINDOW_MS = 20_000;
type Decision = "agora" | "depois" | "chuto";
const LABEL: Record<Decision, string> = {
  agora: "Resolver agora",
  depois: "Deixar para depois",
  chuto: "Chutar",
};

function actionIdFor(scope: string): string {
  const key = `resolve:acao:triagem:${scope}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Triagem de 20 segundos (F4-T04). Uma questão por vez, só leitura, com três decisões. O tempo conta só com a
 * página visível; ao fim dos 20 s a janela se encerra com aviso, mas a questão não avança sozinha.
 * Sem pulsação nem animação: o número muda a cada segundo e só.
 */
export function TriageRunner({ session }: { session: SessionView }) {
  const [decided, setDecided] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(
      session.entries
        .filter((e) => e.triage)
        .map((e) => [e.sessionItemId, e.triage!.decision]),
    ),
  );
  const pending = session.entries.filter((e) => !decided[e.sessionItemId]);
  const entry: SessionEntry | undefined = pending[0];
  const timer = useRef<VisibleTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!entry) return;
    const t = new VisibleTimer(
      undefined,
      document.visibilityState === "visible",
    );
    timer.current = t;
    const onVis = () => t.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => setElapsed(t.ms()), 250);
    headingRef.current?.focus();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [entry]);

  if (!entry) {
    const counts = { agora: 0, depois: 0, chuto: 0 } as Record<
      Decision,
      number
    >;
    for (const d of Object.values(decided)) counts[d] += 1;
    return (
      <section
        aria-labelledby="fim-triagem"
        className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-surface p-5"
      >
        <h2
          id="fim-triagem"
          ref={headingRef}
          tabIndex={-1}
          className="t-section outline-none"
        >
          Triagem concluída
        </h2>
        <p className="t-reading">
          {counts.agora} para agora · {counts.depois} para depois ·{" "}
          {counts.chuto} {counts.chuto === 1 ? "chute" : "chutes"}.
        </p>
        <p className="t-meta text-ink-2">
          Agora resolva as questões. A conferência compara cada decisão com o
          que aconteceu ao resolver.
        </p>
        <Link
          href={`/estudar/sessao/${session.id}`}
          className="inline-flex min-h-11 items-center self-start rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
        >
          Resolver as questões
        </Link>
        <Link
          href={`/estudar/triagem/${session.id}/conferencia`}
          className="t-ui underline"
        >
          Ver a conferência
        </Link>
      </section>
    );
  }

  const left = Math.max(0, WINDOW_MS - elapsed);
  const decide = async (d: Decision) => {
    if (sending) return;
    setSending(true);
    setError(null);
    const ms = Math.min(600000, timer.current?.ms() ?? 0);
    const r = await withSameAction(
      actionIdFor(entry.sessionItemId),
      (actionId) =>
        recordTriage({
          actionId,
          sessionItemId: entry.sessionItemId,
          decision: d,
          visibleMs: ms,
        }).catch(() => ({ ok: false as const, error: "rede", final: false })),
    );
    setSending(false);
    if (!r.ok)
      return setError("Não foi possível registrar a decisão. Tente de novo.");
    setDecided((m) => ({ ...m, [entry.sessionItemId]: r.value.decision }));
    setElapsed(0);
  };
  const index = session.entries.length - pending.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="t-section outline-none">
          Triagem {index + 1} de {session.entries.length}
        </h2>
        <p className="t-ui tabular-nums" role="timer" aria-live="off">
          {left > 0 ? `${Math.ceil(left / 1000)} s` : "Janela encerrada"}
        </p>
      </div>
      <p className="t-meta" role="status">
        {left > 0
          ? "Leia e decida em até 20 segundos. O tempo para quando você sai da página."
          : "Os 20 segundos terminaram. Continue lendo se quiser; a questão só avança quando você decidir."}
      </p>
      <QuestionView
        question={entry.question}
        answer={{
          value: null,
          onValueChange: () => {},
          eliminated: new Set(),
          onToggleEliminate: () => {},
          confirmed: true,
          reveal: null,
        }}
      />
      <div
        role="group"
        aria-label="Decisão da triagem"
        className="sticky bottom-20 flex max-w-[72ch] flex-wrap gap-3 rounded-card border border-line bg-surface p-3 md:bottom-4"
      >
        {(["agora", "depois", "chuto"] as Decision[]).map((d) => (
          <Button
            key={d}
            type="button"
            variant={d === "agora" ? "primary" : "secondary"}
            disabled={sending}
            onClick={() => decide(d)}
          >
            {LABEL[d]}
          </Button>
        ))}
      </div>
      <div aria-live="assertive">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
