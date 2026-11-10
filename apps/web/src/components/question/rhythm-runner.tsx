"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  logEvents,
  setSessionStatus,
  submitAttempt,
} from "@/lib/study/actions";
import { withSameAction } from "@/lib/study/retry";
import {
  DEFAULT_CONFIG,
  parseConfig,
  rhythmStats,
  type RhythmConfig,
} from "@/lib/study/rhythm";
import type { SessionView } from "@/lib/study/session";
import { VisibleTimer } from "@/lib/study/visible-timer";
import { QuestionView } from "./question-view";

const CFG_KEY = "resolve:ritmo:config";
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // sem armazenamento: segue só na memória
  }
  return null;
}

/**
 * Bloco de ritmo (F4-T06): prazo do bloco, tempo por questão (só com a página visível), alvo e aviso
 * ajustáveis, marcar para revisar e navegar sem perder resposta nem tempo. O gabarito só aparece no fim.
 * O aviso é texto discreto, sem animação nem som.
 */
export function RhythmRunner({ session }: { session: SessionView }) {
  const n = session.entries.length;
  const timesKey = `resolve:ritmo:tempos:${session.id}`;
  const [index, setIndex] = useState(0);
  const [cfg, setCfg] = useState<RhythmConfig>(DEFAULT_CONFIG);
  const [times, setTimes] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<
    Record<string, { key: string; correct: boolean | null }>
  >(() =>
    Object.fromEntries(
      session.entries
        .filter((e) => e.feedback?.chosenKey)
        .map((e) => [
          e.sessionItemId,
          { key: e.feedback!.chosenKey!, correct: e.feedback!.isCorrect },
        ]),
    ),
  );
  const [marked, setMarked] = useState<Set<string>>(new Set(session.marked));
  const [choice, setChoice] = useState<string | null>(null);
  const [closed, setClosed] = useState(session.status === "encerrada");
  const [now, setNow] = useState(0);
  const [cur, setCur] = useState<{ id: string; ms: number }>({ id: "", ms: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<VisibleTimer | null>(null);
  const base = useRef(0);
  const entry = session.entries[index];

  // Configuração e tempos guardados no aparelho (voltar à questão ou recarregar preserva o tempo).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setCfg(parseConfig(store(CFG_KEY)));
      try {
        setTimes(JSON.parse(store(timesKey) ?? "{}") as Record<string, number>);
      } catch {
        // tempos corrompidos: recomeça
      }
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(t);
  }, [timesKey]);

  // Relógio da questão atual: só conta com a página visível; ao sair da questão, soma ao total dela.
  useEffect(() => {
    if (!entry || closed) return;
    const id = entry.sessionItemId;
    const t = new VisibleTimer(
      undefined,
      document.visibilityState === "visible",
    );
    timer.current = t;
    base.current = 0;
    const onVis = () => t.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    const tick = window.setInterval(() => {
      setNow(Date.now());
      setCur({ id, ms: t.ms() });
    }, 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(tick);
      const spent = t.ms();
      setTimes((m) => {
        const next = { ...m, [id]: (m[id] ?? 0) + spent };
        store(timesKey, JSON.stringify(next));
        return next;
      });
    };
  }, [entry, closed, timesKey]);

  const deadline = session.deadlineAt
    ? new Date(session.deadlineAt).getTime()
    : null;
  const left = deadline && now ? deadline - now : null;
  const finish = async () => {
    setBusy(true);
    await setSessionStatus({
      sessionId: session.id,
      status: "encerrada",
    }).catch(() => null);
    setBusy(false);
    setClosed(true);
  };
  useEffect(() => {
    if (left !== null && left <= 0 && !closed) {
      const t = window.setTimeout(() => void finish(), 0);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- encerra uma vez quando o prazo acaba
  }, [left !== null && left <= 0, closed]);

  if (closed || !entry) {
    const stats = rhythmStats(
      session.entries.map((e) => ({
        answered: Boolean(answers[e.sessionItemId]),
        correct: answers[e.sessionItemId]?.correct ?? null,
        ms: times[e.sessionItemId] ?? 0,
      })),
    );
    return (
      <section
        aria-labelledby="fim-ritmo"
        className="flex max-w-xl flex-col gap-3 rounded-panel border border-line bg-surface p-5"
      >
        <h2 id="fim-ritmo" className="t-section">
          Bloco encerrado
        </h2>
        <ul className="flex flex-col gap-1 t-reading">
          <li>
            {stats.answered} de {stats.total} respondidas
            {stats.completed ? " — bloco concluído" : " — bloco não concluído"}.
          </li>
          <li>
            Acertos: {stats.correct} de {stats.graded}.
          </li>
          <li>
            Tempo médio por questão:{" "}
            {stats.meanMs === null ? "indisponível" : mmss(stats.meanMs)};
            mediana:{" "}
            {stats.medianMs === null ? "indisponível" : mmss(stats.medianMs)}.
          </li>
        </ul>
        <Link
          href={`/estudar/sessao/${session.id}`}
          className="inline-flex min-h-11 items-center self-start rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
        >
          Ver respostas e gabarito
        </Link>
      </section>
    );
  }

  const id = entry.sessionItemId;
  const spentHere = (times[id] ?? 0) + (cur.id === id ? cur.ms : 0);
  const answered = answers[id];
  const go = (i: number) => {
    setIndex(i);
    setChoice(null);
    setError(null);
  };
  const confirm = async () => {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    const ms = Math.min(86_400_000, Math.round((times[id] ?? 0) + (timer.current?.ms() ?? 0)));
    const actionKey = `resolve:acao:${id}`;
    const actionId = store(actionKey) ?? crypto.randomUUID();
    store(actionKey, actionId);
    const r = await withSameAction(actionId, (a) =>
      submitAttempt({
        actionId: a,
        sessionItemId: id,
        alternativeId: entry.alternativeIds[choice],
        activeMs: ms,
        elapsedMs: ms,
      }).catch(() => ({ ok: false as const, error: "rede", final: false })),
    );
    setBusy(false);
    if (!r.ok)
      return setError(
        r.error === "resolve_deadline_passed"
          ? "O prazo do bloco terminou."
          : "Não foi possível gravar. Sua escolha continua marcada; tente de novo.",
      );
    setAnswers((m) => ({
      ...m,
      [id]: { key: choice, correct: r.value.is_correct },
    }));
  };
  const toggleMark = async () => {
    const on = !marked.has(id);
    setMarked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    await logEvents({
      sessionId: session.id,
      events: [
        {
          client_event_id: `marca-${id}-${Date.now()}`,
          type: on ? "marcada_para_revisar" : "desmarcada_para_revisar",
          session_item_id: id,
          payload: {},
          client_at: new Date().toISOString(),
        },
      ],
    }).catch(() => null);
  };
  const saveCfg = (next: RhythmConfig) => {
    const fixed = parseConfig(JSON.stringify(next));
    setCfg(fixed);
    store(CFG_KEY, JSON.stringify(fixed));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="t-section">
          Questão {index + 1} de {n}
        </h2>
        <p className="t-ui tabular-nums">
          Bloco: {left === null ? "--:--" : mmss(left)} · nesta questão:{" "}
          {mmss(spentHere)}
        </p>
      </div>
      <p className="t-meta" role="status">
        {spentHere >= cfg.warnMin * 60_000
          ? `Mais de ${cfg.warnMin} min nesta questão. Você pode marcar para revisar e seguir.`
          : `Alvo: ${cfg.targetMin} min por questão.`}
      </p>
      <nav aria-label="Questões do bloco" className="flex flex-wrap gap-1.5">
        {session.entries.map((e, i) => (
          <button
            key={e.sessionItemId}
            type="button"
            onClick={() => go(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Questão ${i + 1}${answers[e.sessionItemId] ? ", respondida" : ""}${marked.has(e.sessionItemId) ? ", marcada para revisar" : ""}`}
            className={clsx(
              "grid size-11 place-items-center rounded-control border t-ui tabular-nums",
              i === index ? "border-ink border-2" : "border-line",
              answers[e.sessionItemId] ? "bg-surface-subtle" : "bg-surface",
            )}
          >
            {i + 1}
            {marked.has(e.sessionItemId) ? "•" : ""}
          </button>
        ))}
      </nav>
      <QuestionView
        question={entry.question}
        answer={{
          value: answered?.key ?? choice,
          onValueChange: setChoice,
          eliminated: new Set(),
          onToggleEliminate: () => {},
          confirmed: Boolean(answered) || busy,
          reveal: null, // gabarito só no fim do bloco
        }}
      />
      <div className="flex max-w-[72ch] flex-wrap items-center gap-3">
        {!answered ? (
          <Button
            type="button"
            onClick={confirm}
            loading={busy}
            disabled={!choice}
          >
            Confirmar resposta
          </Button>
        ) : (
          <span className="t-meta">
            Resposta gravada. O gabarito aparece no fim do bloco.
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          aria-pressed={marked.has(id)}
          onClick={toggleMark}
        >
          {marked.has(id) ? "Desmarcar revisão" : "Marcar para revisar"}
        </Button>
        {index > 0 && (
          <Button type="button" variant="ghost" onClick={() => go(index - 1)}>
            Anterior
          </Button>
        )}
        {index + 1 < n && (
          <Button type="button" variant="ghost" onClick={() => go(index + 1)}>
            Próxima
          </Button>
        )}
      </div>
      <div aria-live="assertive">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
      <details className="max-w-[72ch] rounded-card border border-line-subtle bg-surface p-3">
        <summary className="cursor-pointer t-ui">Alvo e aviso</summary>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 t-meta">
            Alvo por questão (min)
            <input
              type="number"
              min={1}
              max={15}
              value={cfg.targetMin}
              onChange={(e) =>
                saveCfg({ ...cfg, targetMin: Number(e.target.value) })
              }
              className="min-h-11 w-24 rounded-control border border-line bg-surface px-3 t-ui"
            />
          </label>
          <label className="flex flex-col gap-1 t-meta">
            Aviso depois de (min)
            <input
              type="number"
              min={1}
              max={20}
              value={cfg.warnMin}
              onChange={(e) =>
                saveCfg({ ...cfg, warnMin: Number(e.target.value) })
              }
              className="min-h-11 w-24 rounded-control border border-line bg-surface px-3 t-ui"
            />
          </label>
        </div>
      </details>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        loading={busy}
        onClick={finish}
      >
        Encerrar bloco
      </Button>
    </div>
  );
}
