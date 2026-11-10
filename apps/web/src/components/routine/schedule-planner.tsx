"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";

const noop = () => () => {};
/** Verdadeiro só depois da hidratação: antes disso o envio nativo do formulário perderia a ação. */
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  addWeeklyRule,
  changeOneDay,
  removeWeeklyRule,
  undoOneDay,
  type ScheduleResult,
} from "@/lib/routine/schedule-actions";
import type { ScheduleData } from "@/lib/routine/schedule";
import {
  WEEKDAYS,
  dateInZone,
  dayLabel,
  groupByDay,
  hhmm,
  occurrenceRange,
  type Occurrence,
  type WeeklyRule,
} from "@/lib/routine/schedule-types";

const selectCls =
  "w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";
const KIND_LABEL = {
  disponivel: "Horário livre",
  compromisso: "Compromisso fixo",
} as const;

/**
 * Rotina (F4-T13): horários livres e compromissos que se repetem toda semana, e mudanças de um único dia.
 * Mudar ou cancelar um dia cria uma exceção; a regra semanal continua igual. Nada se move sozinho:
 * cada mudança acontece por um botão, e o banco recusa sobreposições explicando com o quê.
 */
export function SchedulePlanner({ data }: { data: ScheduleData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{
    scope: string;
    r: ScheduleResult;
    okText?: string;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const run = (
    scope: string,
    fn: () => Promise<ScheduleResult>,
    okText?: string,
    after?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      setFeedback({ scope, r, okText });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const message = (scope: string) =>
    feedback?.scope === scope ? (
      <p role={feedback.r.ok ? "status" : "alert"} className="t-ui">
        {feedback.r.ok ? feedback.okText : feedback.r.message}
      </p>
    ) : null;

  const ruleById = new Map(data.rules.map((r) => [r.id, r]));
  const byDay = groupByDay(data.days, data.occurrences);
  const canceled = data.exceptions.filter((e) => e.action === "cancelar");

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-14">
      <section aria-labelledby="proximos-dias" className="min-w-0">
        <h2 id="proximos-dias" className="mb-1 t-section">
          Próximos 7 dias
        </h2>
        <p className="mb-5 max-w-2xl t-meta text-ink-2">
          Mudar ou cancelar um dia vale só para aquele dia; a regra da semana
          continua igual. Horários no fuso {data.timezone} (troque em Mais ›
          Preferências).
        </p>
        {data.rules.length === 0 && (
          <p className="mb-4 t-ui">
            Nenhum horário ainda. Comece pelos horários livres e compromissos
            fixos em “Toda semana”.
          </p>
        )}
        <ol className="flex flex-col border-t border-line">
          {data.days.map((day) => {
            const list = byDay.get(day) ?? [];
            const off = canceled.filter((e) => e.on_date === day);
            return (
              <li
                key={day}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 border-b border-line-subtle py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <h3 className="pt-0.5 t-ui">
                  {day === data.today ? (
                    <span aria-hidden="true" className="mr-1.5 rounded-full bg-mark-yellow px-2 py-0.5 t-meta font-medium text-on-mark">
                      Hoje
                    </span>
                  ) : null}
                  <span className={day === data.today ? "sr-only" : ""}>
                    {day === data.today ? "Hoje · " : ""}
                  </span>
                  <span
                    className={
                      day === data.today ? "t-meta text-ink-2" : "text-ink"
                    }
                  >
                    {dayLabel(day)}
                  </span>
                </h3>
                {list.length === 0 && off.length === 0 ? (
                  <p className="pt-0.5 t-meta text-ink-2">Nada marcado.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line-subtle">
                    {list.map((o) => (
                      <OccurrenceRow
                        key={`${o.source_id}-${o.starts_at}`}
                        o={o}
                        rule={o.rule_id ? ruleById.get(o.rule_id) : undefined}
                        editing={editing === `${o.source_id}-${o.starts_at}`}
                        pending={pending}
                        onEdit={(v) =>
                          setEditing(v ? `${o.source_id}-${o.starts_at}` : null)
                        }
                        run={run}
                        message={message}
                      />
                    ))}
                    {off.map((e) => {
                      const rule = e.rule_id
                        ? ruleById.get(e.rule_id)
                        : undefined;
                      return (
                        <li key={e.id} className="flex flex-col gap-2 py-3">
                          <p className="t-ui">
                            <span className="line-through decoration-1">
                              {rule
                                ? `${hhmm(rule.start_time)}–${hhmm(rule.end_time)}`
                                : ""}{" "}
                              {rule?.title ?? KIND_LABEL[e.kind]}
                            </span>{" "}
                            <span className="t-meta text-ink-2">
                              cancelado só neste dia
                            </span>
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="self-start"
                            disabled={pending}
                            onClick={() =>
                              run(
                                e.id,
                                () => undoOneDay({ id: e.id }),
                                "Cancelamento desfeito.",
                              )
                            }
                          >
                            Desfazer cancelamento
                          </Button>
                          {message(e.id)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="toda-semana" className="min-w-0">
        <h2 id="toda-semana" className="mb-1 t-section">
          Toda semana
        </h2>
        <p className="mb-5 t-meta text-ink-2">
          Horários livres viram o espaço do plano do dia; compromissos ficam
          intocados.
        </p>
        <WeeklyForm pending={pending} run={run} message={message} />
        {(["disponivel", "compromisso"] as const).map((kind) => {
          const list = data.rules.filter((r) => r.kind === kind);
          return (
            <div key={kind} className="mt-6">
              <h3 className="mb-2 t-ui font-semibold">
                {kind === "disponivel"
                  ? "Horários livres"
                  : "Compromissos fixos"}
              </h3>
              {list.length === 0 ? (
                <p className="t-meta text-ink-2">Nenhum.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 py-3">
                      <p className="t-ui">
                        {WEEKDAYS[r.weekday]}, {hhmm(r.start_time)}–
                        {hhmm(r.end_time)}
                        {r.title ? ` · ${r.title}` : ""}
                        {r.timezone !== data.timezone ? (
                          <span className="t-meta text-ink-2">
                            {" "}
                            (fuso {r.timezone})
                          </span>
                        ) : null}
                        {r.valid_until ? (
                          <span className="t-meta text-ink-2">
                            {" "}
                            até {r.valid_until.split("-").reverse().join("/")}
                          </span>
                        ) : null}
                      </p>
                      {confirmRemove === r.id ? (
                        <div
                          role="alertdialog"
                          aria-label="Confirmar remoção do horário"
                          className="flex flex-wrap items-center gap-3"
                        >
                          <span className="t-ui">
                            Remover de todas as semanas, com as mudanças de um
                            dia?
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            loading={pending}
                            onClick={() =>
                              run(
                                r.id,
                                () =>
                                  removeWeeklyRule({ kind: r.kind, id: r.id }),
                                "Horário removido.",
                                () => setConfirmRemove(null),
                              )
                            }
                          >
                            Remover
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() => setConfirmRemove(null)}
                          >
                            Manter
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="-ml-3 self-start text-ink-2"
                          onClick={() => setConfirmRemove(r.id)}
                        >
                          Remover de todas as semanas
                        </Button>
                      )}
                      {message(r.id)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

type Run = (
  scope: string,
  fn: () => Promise<ScheduleResult>,
  okText?: string,
  after?: () => void,
) => void;

function OccurrenceRow({
  o,
  rule,
  editing,
  pending,
  onEdit,
  run,
  message,
}: {
  o: Occurrence;
  rule: WeeklyRule | undefined;
  editing: boolean;
  pending: boolean;
  onEdit: (v: boolean) => void;
  run: Run;
  message: (scope: string) => ReactNode;
}) {
  const scope = `${o.source_id}-${o.starts_at}`;
  const hydrated = useHydrated();
  const [startT, setStartT] = useState(hhmm(o.local_start));
  const [endT, setEndT] = useState(hhmm(o.local_end));
  // A data e o horário da exceção ficam no fuso da regra.
  const ruleDate = rule ? dateInZone(o.starts_at, rule.timezone) : null;
  return (
    <li className="flex flex-col gap-2 py-3">
      <p className="t-ui">
        <span className="tabular-nums">{occurrenceRange(o)}</span> ·{" "}
        {o.title ?? KIND_LABEL[o.kind]}
        <span className="t-meta text-ink-2">
          {" "}
          · {o.kind === "compromisso" ? "compromisso" : "livre"}
          {o.changed ? " · mudado só neste dia" : ""}
        </span>
      </p>
      {o.source === "regra" && rule && ruleDate ? (
        editing ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                scope,
                () =>
                  changeOneDay({
                    action: "mover",
                    kind: o.kind,
                    ruleId: rule.id,
                    date: ruleDate,
                    start: startT,
                    end: endT,
                  }),
                "Horário mudado só neste dia.",
                () => onEdit(false),
              );
            }}
          >
            <p className="t-meta text-ink-2">
              Novo horário em {dayLabel(ruleDate)} (fuso {rule.timezone}).
            </p>
            <div className="grid max-w-md grid-cols-2 gap-3">
              <TextField
                label="Início"
                type="time"
                step={300}
                value={startT}
                onChange={(e) => setStartT(e.target.value)}
                required
              />
              <TextField
                label="Fim"
                type="time"
                step={300}
                value={endT}
                onChange={(e) => setEndT(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                size="sm"
                loading={pending}
                disabled={!hydrated}
              >
                Salvar só neste dia
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onEdit(false)}
              >
                Voltar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onEdit(true)}
            >
              Mudar só neste dia
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  scope,
                  () =>
                    changeOneDay({
                      action: "cancelar",
                      kind: o.kind,
                      ruleId: rule.id,
                      date: ruleDate,
                    }),
                  "Cancelado só neste dia.",
                )
              }
            >
              Cancelar só neste dia
            </Button>
          </div>
        )
      ) : o.source === "excecao" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={() =>
            run(
              scope,
              () => undoOneDay({ id: o.source_id }),
              "Mudança desfeita.",
            )
          }
        >
          Desfazer mudança
        </Button>
      ) : null}
      {message(scope)}
    </li>
  );
}

function WeeklyForm({
  pending,
  run,
  message,
}: {
  pending: boolean;
  run: Run;
  message: (scope: string) => ReactNode;
}) {
  const empty = {
    kind: "disponivel" as "disponivel" | "compromisso",
    title: "",
    weekday: "1",
    start: "",
    end: "",
  };
  const hydrated = useHydrated();
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      aria-label="Novo horário semanal"
      className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 shadow-paper sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          "semanal",
          () => addWeeklyRule(form),
          "Horário criado.",
          () => setForm({ ...empty, kind: form.kind, weekday: form.weekday }),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 t-ui">
          Tipo
          <select
            className={selectCls}
            value={form.kind}
            onChange={set("kind")}
          >
            <option value="disponivel">Horário livre para estudar</option>
            <option value="compromisso">Compromisso fixo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 t-ui">
          Dia da semana
          <select
            className={selectCls}
            value={form.weekday}
            onChange={set("weekday")}
          >
            {WEEKDAYS.map((w, i) => (
              <option key={w} value={i}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>
      {form.kind === "compromisso" && (
        <TextField
          label="Nome do compromisso"
          hint="Ex.: aula de inglês, trabalho, treino."
          value={form.title}
          onChange={set("title")}
          maxLength={80}
        />
      )}
      <div className="grid max-w-md grid-cols-2 gap-4">
        <TextField
          label="Início"
          type="time"
          step={300}
          value={form.start}
          onChange={set("start")}
          required
        />
        <TextField
          label="Fim"
          type="time"
          step={300}
          value={form.end}
          onChange={set("end")}
          required
        />
      </div>
      <Button
        type="submit"
        className="self-start"
        loading={pending}
        disabled={!hydrated}
      >
        Adicionar toda semana
      </Button>
      <div aria-live="polite">{message("semanal")}</div>
    </form>
  );
}
