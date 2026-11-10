"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getExplanation,
  requestHelp,
  setErrorReason,
  submitAttempt,
} from "@/lib/study/actions";
import { buildRaioX, type RaioXView } from "@/lib/study/raiox";
import { flushPending, pendingFor, savePending } from "@/lib/study/pending";
import { ERROR_REASONS } from "@/lib/study/reasons";
import { withSameAction, type Outcome } from "@/lib/study/retry";
import type { SubmitResult } from "@/lib/study/actions";
import type { SessionEntry, SessionView } from "@/lib/study/session";
import { QuestionView } from "./question-view";
import { RaioXPanel } from "./raiox-panel";

const noop = () => () => {};

type Result = NonNullable<SessionEntry["feedback"]>;

/** Identificador da confirmação: criado uma vez por questão e guardado, para que reenvio e recarga não dupliquem. */
function actionIdFor(sessionItemId: string): string {
  const key = `resolve:acao:${sessionItemId}`;
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

/** Envia a resposta; sem conexão a ação do servidor lança erro, tratado como falha de rede (reenviável). */
async function send(
  actionId: string,
  sessionItemId: string,
  alternativeId: string,
  ms: number,
): Promise<Outcome<SubmitResult>> {
  try {
    return await submitAttempt({
      actionId,
      sessionItemId,
      alternativeId,
      activeMs: ms,
      elapsedMs: ms,
    });
  } catch {
    return { ok: false, error: "rede", final: false };
  }
}

const ERRORS: Record<string, string> = {
  resolve_session_closed: "Esta sessão foi encerrada.",
  resolve_already_answered: "Esta questão já foi respondida.",
  resolve_deadline_passed: "O prazo da sessão terminou.",
};

/**
 * Resolver (F3-T02): uma questão por vez, com a resposta gravada no servidor antes de revelar o gabarito.
 * Recarregar mostra de novo a resposta dada (o retorno vem do banco só para questões respondidas).
 */
export function SessionRunner({ session }: { session: SessionView }) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const firstOpen = session.entries.findIndex((e) => !e.feedback);
  const [index, setIndex] = useState(
    firstOpen === -1 ? session.entries.length : firstOpen,
  );
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(
      session.entries
        .filter((e) => e.feedback)
        .map((e) => [e.sessionItemId, e.feedback!]),
    ),
  );
  const [value, setValue] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raiox, setRaiox] = useState<Record<string, RaioXView>>({});
  const [loadingX, setLoadingX] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState(false);
  /** Respostas guardadas no aparelho que ainda não chegaram ao servidor (F3-T03). */
  const [pending, setPending] = useState<Record<string, string>>({});

  const applyResult = (e: SessionEntry, key: string, v: SubmitResult) => {
    const keyById = Object.fromEntries(
      Object.entries(e.alternativeIds).map(([k, id]) => [id, k]),
    );
    setResults((m) => ({
      ...m,
      [e.sessionItemId]: {
        chosenKey: key,
        correctKey: v.correct_alternative_id
          ? (keyById[v.correct_alternative_id] ?? null)
          : null,
        isCorrect: v.is_correct,
        errorEntryId: v.error_entry_id,
        reason: v.error_entry_id ? "not_reported" : null,
      },
    }));
    setPending((m) => {
      const n = { ...m };
      delete n[e.sessionItemId];
      return n;
    });
  };

  // Ao abrir a tela e sempre que a conexão volta: reenvia o que ficou guardado, com a mesma ação.
  useEffect(() => {
    let stop = false;
    const flush = async () => {
      let store: Storage;
      try {
        store = localStorage;
      } catch {
        return;
      }
      const list = pendingFor(store, session.id);
      if (!list.length) return;
      setPending(
        Object.fromEntries(
          list.map((p) => [p.sessionItemId, p.alternativeKey]),
        ),
      );
      await flushPending(store, session.id, async (p) => {
        const r = await send(
          p.actionId,
          p.sessionItemId,
          p.alternativeId,
          p.activeMs,
        );
        const e = session.entries.find(
          (x) => x.sessionItemId === p.sessionItemId,
        );
        if (r.ok && e && !stop) applyResult(e, p.alternativeKey, r.value);
        if (!r.ok && r.final && !stop)
          setPending((m) => {
            const n = { ...m };
            delete n[p.sessionItemId];
            return n;
          });
        return r.ok ? { ok: true } : { ok: false, final: r.final };
      });
    };
    void flush();
    window.addEventListener("online", flush);
    return () => {
      stop = true;
      window.removeEventListener("online", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por sessão; applyResult só usa setters
  }, [session.id]);
  const shownAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const entry = session.entries[index];
  useEffect(() => {
    shownAt.current = performance.now();
    headingRef.current?.focus();
  }, [index]);

  const total = session.entries.length;
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter((r) => r.isCorrect).length;

  if (!entry) {
    return (
      <section
        aria-labelledby="fim"
        className="flex max-w-xl flex-col gap-4 rounded-panel border border-line bg-surface p-5"
      >
        <h2
          id="fim"
          ref={headingRef}
          tabIndex={-1}
          className="t-section outline-none"
        >
          Treino concluído
        </h2>
        <p className="t-reading">
          {correct} de {total} {total === 1 ? "acerto" : "acertos"}. Os erros
          entraram no caderno e na revisão.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/estudar"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
          >
            Novo treino
          </Link>
          {total > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIndex(0)}
            >
              Rever as respostas
            </Button>
          )}
        </div>
      </section>
    );
  }

  const result = results[entry.sessionItemId];
  const pendingKey = result ? undefined : pending[entry.sessionItemId];
  const go = (i: number) => {
    setIndex(i);
    setValue(null);
    setEliminated(new Set());
    setError(null);
    setConfirmHelp(false);
  };

  const view = raiox[entry.sessionItemId];
  const openRaioX = async (help: boolean) => {
    setLoadingX(true);
    setError(null);
    const r = help
      ? await requestHelp({
          sessionId: session.id,
          sessionItemId: entry.sessionItemId,
        })
      : await getExplanation({ sessionItemId: entry.sessionItemId });
    setLoadingX(false);
    setConfirmHelp(false);
    const v = r.ok ? buildRaioX(entry.question, r.value) : null;
    if (!v) {
      setError("Não foi possível abrir o Raio-X agora. Tente de novo.");
      return;
    }
    setRaiox((m) => ({ ...m, [entry.sessionItemId]: v }));
    requestAnimationFrame(() =>
      document.getElementById(`raiox-${entry.sessionItemId}`)?.focus(),
    );
  };

  const confirm = async () => {
    if (!value || sending) return;
    setSending(true);
    setError(null);
    const ms = Math.round(performance.now() - shownAt.current);
    const actionId = actionIdFor(entry.sessionItemId);
    const alternativeId = entry.alternativeIds[value]!;
    const r = await withSameAction(actionId, (a) =>
      send(a, entry.sessionItemId, alternativeId, ms),
    );
    setSending(false);
    if (!r.ok) {
      if (!r.final) {
        // Sem conexão: guarda no aparelho com a mesma ação; reenvia ao reabrir ou quando a rede voltar.
        savePending(localStorage, {
          sessionId: session.id,
          sessionItemId: entry.sessionItemId,
          actionId,
          alternativeKey: value,
          alternativeId,
          activeMs: ms,
          savedAt: new Date().toISOString(),
        });
        setPending((m) => ({ ...m, [entry.sessionItemId]: value }));
        return;
      }
      setError(
        ERRORS[r.error] ??
          "Não foi possível gravar a resposta. Sua escolha continua marcada; tente de novo.",
      );
      return;
    }
    applyResult(entry, value, r.value);
  };

  const chooseReason = async (code: string) => {
    if (!result?.errorEntryId) return;
    const r = await setErrorReason({
      entryId: result.errorEntryId,
      reason: code,
    });
    if (r.ok)
      setResults((m) => ({
        ...m,
        [entry.sessionItemId]: { ...result, reason: code },
      }));
  };

  const correctLetter = result?.correctKey
    ? entry.question.alternatives.find((a) => a.key === result.correctKey)
        ?.letter
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="t-section outline-none">
          Questão {index + 1} de {total}
        </h2>
        <p className="t-meta text-ink-2">
          {answered} {answered === 1 ? "respondida" : "respondidas"} · {correct}{" "}
          {correct === 1 ? "acerto" : "acertos"}
        </p>
      </div>

      <QuestionView
        question={entry.question}
        answer={{
          value: result ? result.chosenKey : (pendingKey ?? value),
          onValueChange: setValue,
          eliminated: result ? new Set() : eliminated,
          onToggleEliminate: (k) =>
            setEliminated((s) => {
              const n = new Set(s);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            }),
          confirmed: Boolean(result) || Boolean(pendingKey) || sending,
          reveal: result?.correctKey ? { correctKey: result.correctKey } : null,
        }}
      />

      <div className="flex max-w-[72ch] flex-col gap-4">
        {pendingKey ? (
          <p role="status" className="rounded-card border border-ink p-3 t-ui">
            Sem conexão: sua resposta ficou guardada neste aparelho e será
            enviada quando a conexão voltar. Pode seguir para a próxima.
          </p>
        ) : !result ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={confirm}
              loading={sending}
              disabled={!hydrated || !value}
            >
              Confirmar resposta
            </Button>
            {!value && (
              <span className="t-meta text-ink-2">
                Escolha uma alternativa.
              </span>
            )}
            {!view &&
              (confirmHelp ? (
                <span
                  role="alertdialog"
                  aria-label="Confirmar ajuda"
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="t-meta">
                    A tentativa ficará marcada como feita com ajuda.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    loading={loadingX}
                    onClick={() => openRaioX(true)}
                  >
                    Ver resolução
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmHelp(false)}
                  >
                    Voltar
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!hydrated}
                  onClick={() => setConfirmHelp(true)}
                >
                  Pedir ajuda
                </Button>
              ))}
          </div>
        ) : (
          <div role="status" className="flex items-center gap-2 t-ui">
            {result.isCorrect ? (
              <>
                <Check
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={2.5}
                />{" "}
                Você acertou.
              </>
            ) : (
              <>
                <X aria-hidden="true" className="size-5" strokeWidth={2.5} />{" "}
                Resposta correta: {correctLetter ?? "indisponível"}.
              </>
            )}
          </div>
        )}
        {result && !view && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            loading={loadingX}
            onClick={() => openRaioX(false)}
          >
            Ver Raio-X
          </Button>
        )}
        {view && (
          <RaioXPanel view={view} headingId={`raiox-${entry.sessionItemId}`} />
        )}
        <div aria-live="assertive">
          {error && (
            <p role="alert" className="t-ui">
              {error}
            </p>
          )}
        </div>

        {result && !result.isCorrect && result.errorEntryId && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 t-ui">O que aconteceu? (opcional)</legend>
            <div className="flex flex-wrap gap-2">
              {ERROR_REASONS.filter((r) => r.code !== "not_reported").map(
                (r) => (
                  <button
                    key={r.code}
                    type="button"
                    aria-pressed={result.reason === r.code}
                    onClick={() =>
                      chooseReason(
                        result.reason === r.code ? "not_reported" : r.code,
                      )
                    }
                    className="min-h-11 rounded-control border border-line px-3 t-meta text-ink hover:bg-surface-subtle aria-pressed:border-ink aria-pressed:bg-surface-subtle aria-pressed:font-semibold"
                  >
                    {r.label}
                  </button>
                ),
              )}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-3">
          {index > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => go(index - 1)}
            >
              Anterior
            </Button>
          )}
          {(result || pendingKey) && (
            <Button type="button" onClick={() => go(index + 1)}>
              {index + 1 < total ? "Próxima questão" : "Ver resultado"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
