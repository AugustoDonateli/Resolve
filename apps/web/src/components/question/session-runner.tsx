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
import { ERROR_REASONS } from "@/lib/study/reasons";
import { withSameAction } from "@/lib/study/retry";
import type { SessionEntry, SessionView } from "@/lib/study/session";
import { QuestionView } from "./question-view";
import { RaioXPanel } from "./raiox-panel";

const noop = () => () => {};

type Result = NonNullable<SessionEntry["feedback"]>;

/** Identificador da confirmação: criado uma vez por questão e guardado, para que reenvio e recarga não dupliquem. */
function actionIdFor(sessionItemId: string): string {
  const key = `resolve:acao:${sessionItemId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
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
    const r = await withSameAction(
      actionIdFor(entry.sessionItemId),
      (actionId) =>
        submitAttempt({
          actionId,
          sessionItemId: entry.sessionItemId,
          alternativeId: entry.alternativeIds[value],
          activeMs: ms,
          elapsedMs: ms,
        }),
    );
    setSending(false);
    if (!r.ok) {
      setError(
        ERRORS[r.error] ??
          "Não foi possível gravar a resposta. Sua escolha continua marcada; tente de novo.",
      );
      return;
    }
    const keyById = Object.fromEntries(
      Object.entries(entry.alternativeIds).map(([k, id]) => [id, k]),
    );
    setResults((m) => ({
      ...m,
      [entry.sessionItemId]: {
        chosenKey: value,
        correctKey: r.value.correct_alternative_id
          ? (keyById[r.value.correct_alternative_id] ?? null)
          : null,
        isCorrect: r.value.is_correct,
        errorEntryId: r.value.error_entry_id,
        reason: r.value.error_entry_id ? "not_reported" : null,
      },
    }));
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
          value: result ? result.chosenKey : value,
          onValueChange: setValue,
          eliminated: result ? new Set() : eliminated,
          onToggleEliminate: (k) =>
            setEliminated((s) => {
              const n = new Set(s);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            }),
          confirmed: Boolean(result) || sending,
          reveal: result?.correctKey ? { correctKey: result.correctKey } : null,
        }}
      />

      <div className="flex max-w-[72ch] flex-col gap-4">
        {!result ? (
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
          {result && (
            <Button type="button" onClick={() => go(index + 1)}>
              {index + 1 < total ? "Próxima questão" : "Ver resultado"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
