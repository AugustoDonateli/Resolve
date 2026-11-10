"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  saveGoal,
  savePlan,
  setArchived,
  type GoalResult,
} from "@/lib/routine/goal-actions";
import type { Goal, IfThenPlan } from "@/lib/routine/goals";
import { fmtDuration } from "@/lib/demo/routine";

const AREA = {
  LC: "Linguagens",
  MT: "Matemática",
  CN: "Ciências da Natureza",
  CH: "Ciências Humanas",
  RED: "Redação",
} as const;
const LEVEL = {
  diaria: "Meta diária",
  semanal: "Meta semanal",
  area: "Meta por área",
} as const;
const selectCls =
  "w-full min-w-0 min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";
const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function goalSummary(
  g: Pick<Goal, "level" | "area_code" | "target_minutes" | "target_score">,
): string {
  const parts: string[] = [];
  if (g.level === "area" && g.area_code) parts.push(AREA[g.area_code]);
  if (g.target_score !== null && g.target_score !== undefined)
    parts.push(`nota-alvo ${Number(g.target_score).toLocaleString("pt-BR")}`);
  if (g.target_minutes)
    parts.push(
      `${fmtDuration(g.target_minutes)}${g.level === "diaria" ? " por dia" : " por semana"}`,
    );
  return parts.join(" · ");
}

type Run = (
  scope: string,
  fn: () => Promise<GoalResult>,
  okText: string,
  after?: () => void,
) => void;

/**
 * Metas e planos se-então (F4-T14). Editar mantém a mesma meta; arquivar guarda e permite restaurar.
 * A nota-alvo é escolha do aluno, não uma estimativa do sistema.
 */
export function GoalsPanel({
  goals,
  plans,
}: {
  goals: Goal[];
  plans: IfThenPlan[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<{
    scope: string;
    r: GoalResult;
    ok: string;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const run: Run = (scope, fn, ok, after) =>
    start(async () => {
      const r = await fn();
      setFb({ scope, r, ok });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const msg = (scope: string): ReactNode =>
    fb?.scope === scope ? (
      <p role={fb.r.ok ? "status" : "alert"} className="t-ui">
        {fb.r.ok ? fb.ok : fb.r.message}
      </p>
    ) : null;
  const activeGoals = goals.filter((g) => !g.archived_at);
  const activePlans = plans.filter((p) => !p.archived_at);
  const archived = [
    ...goals.filter((g) => g.archived_at),
    ...plans.filter((p) => p.archived_at),
  ];

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
      <section aria-labelledby="metas" className="min-w-0">
        <h2 id="metas" className="mb-1 t-section">
          Metas
        </h2>
        <p className="mb-4 max-w-2xl t-meta text-ink-2">
          Uma meta ativa por tipo e por área. Arquivar guarda a meta para
          restaurar depois.
        </p>
        {activeGoals.length === 0 ? (
          <p className="mb-4 t-ui">Nenhuma meta ativa.</p>
        ) : (
          <ul className="mb-5 flex flex-col">
            {activeGoals.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-2 border-b border-line-subtle py-3 first:border-t"
              >
                <p className="t-ui">
                  <span className="font-semibold">{LEVEL[g.level]}</span> ·{" "}
                  {goalSummary(g)}
                </p>
                {editing === g.id ? (
                  <GoalForm
                    goal={g}
                    pending={pending}
                    run={run}
                    msg={msg}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(g.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(
                          g.id,
                          () =>
                            setArchived({
                              table: "goals",
                              id: g.id,
                              archived: true,
                            }),
                          "Meta arquivada.",
                        )
                      }
                    >
                      Arquivar
                    </Button>
                  </div>
                )}
                {msg(g.id)}
              </li>
            ))}
          </ul>
        )}
        <GoalForm pending={pending} run={run} msg={msg} />
      </section>

      <section aria-labelledby="planos" className="min-w-0">
        <h2 id="planos" className="mb-1 scroll-mt-24 t-section">
          Planos se-então
        </h2>
        <p className="mb-4 max-w-2xl t-meta text-ink-2">
          Uma alternativa curta para dias difíceis: “Se…, então…”, de até 60
          minutos.
        </p>
        {activePlans.length === 0 ? (
          <p className="mb-4 t-ui">Nenhum plano ativo.</p>
        ) : (
          <ul className="mb-5 flex flex-col">
            {activePlans.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 border-b border-line-subtle py-3 first:border-t"
              >
                <p className="t-ui">
                  {p.trigger_text}, então {p.alternative_activity}{" "}
                  <span className="t-meta text-ink-2">
                    ({fmtDuration(p.duration_minutes)})
                  </span>
                </p>
                {editing === p.id ? (
                  <PlanForm
                    plan={p}
                    pending={pending}
                    run={run}
                    msg={msg}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(p.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(
                          p.id,
                          () =>
                            setArchived({
                              table: "if_then_plans",
                              id: p.id,
                              archived: true,
                            }),
                          "Plano arquivado.",
                        )
                      }
                    >
                      Arquivar
                    </Button>
                  </div>
                )}
                {msg(p.id)}
              </li>
            ))}
          </ul>
        )}
        <PlanForm pending={pending} run={run} msg={msg} />
      </section>

      {archived.length > 0 && (
        <section aria-labelledby="arquivadas" className="lg:col-span-2">
          <h2 id="arquivadas" className="mb-3 t-section">
            Arquivadas
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((x) => {
              const isGoal = "level" in x;
              return (
                <li
                  key={x.id}
                  className="flex flex-col gap-2 border-b border-line-subtle py-3 first:border-t"
                >
                  <p className="t-ui text-ink-2">
                    {isGoal
                      ? `${LEVEL[x.level]} · ${goalSummary(x)}`
                      : `${x.trigger_text}, então ${x.alternative_activity}`}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    disabled={pending}
                    onClick={() =>
                      run(
                        x.id,
                        () =>
                          setArchived({
                            table: isGoal ? "goals" : "if_then_plans",
                            id: x.id,
                            archived: false,
                          }),
                        "Restaurado.",
                      )
                    }
                  >
                    Restaurar
                  </Button>
                  {msg(x.id)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function GoalForm({
  goal,
  pending,
  run,
  msg,
  onDone,
}: {
  goal?: Goal;
  pending: boolean;
  run: Run;
  msg: (s: string) => ReactNode;
  onDone?: () => void;
}) {
  const hydrated = useHydrated();
  const scope = goal ? `meta-${goal.id}` : "nova-meta";
  const [f, setF] = useState({
    level: goal?.level ?? "diaria",
    area: goal?.area_code ?? "MT",
    minutes: goal?.target_minutes ? String(goal.target_minutes) : "",
    score:
      goal?.target_score !== null && goal?.target_score !== undefined
        ? String(Number(goal.target_score))
        : "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      aria-label={goal ? "Editar meta" : "Nova meta"}
      className={
        goal
          ? "flex flex-col gap-3"
          : "flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 shadow-paper sm:p-5"
      }
      onSubmit={(e) => {
        e.preventDefault();
        run(
          scope,
          () =>
            saveGoal({
              id: goal?.id,
              level: f.level,
              area: f.level === "area" ? f.area : undefined,
              minutes: f.minutes || undefined,
              score: f.level === "area" ? f.score || undefined : undefined,
            }),
          goal ? "Meta salva." : "Meta criada.",
          () =>
            goal ? onDone?.() : setF((x) => ({ ...x, minutes: "", score: "" })),
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!goal && (
          <label className="flex min-w-0 flex-col gap-1.5 t-ui">
            Tipo de meta
            <select
              className={selectCls}
              value={f.level}
              onChange={set("level")}
            >
              <option value="diaria">Diária (minutos por dia)</option>
              <option value="semanal">Semanal (minutos por semana)</option>
              <option value="area">
                Por área (nota-alvo e minutos por semana)
              </option>
            </select>
          </label>
        )}
        {f.level === "area" && !goal && (
          <label className="flex min-w-0 flex-col gap-1.5 t-ui">
            Área
            <select className={selectCls} value={f.area} onChange={set("area")}>
              {Object.entries(AREA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
        <TextField
          label={
            f.level === "diaria" ? "Minutos por dia" : "Minutos por semana"
          }
          type="number"
          inputMode="numeric"
          min={5}
          value={f.minutes}
          onChange={set("minutes")}
          required={f.level !== "area"}
        />
        {f.level === "area" && (
          <TextField
            label="Nota-alvo (0 a 1000)"
            type="number"
            inputMode="decimal"
            min={0}
            max={1000}
            value={f.score}
            onChange={set("score")}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          size={goal ? "sm" : "md"}
          loading={pending}
          disabled={!hydrated}
        >
          {goal ? "Salvar meta" : "Criar meta"}
        </Button>
        {goal && (
          <Button type="button" size="sm" variant="secondary" onClick={onDone}>
            Voltar
          </Button>
        )}
      </div>
      <div aria-live="polite">{msg(scope)}</div>
    </form>
  );
}

function PlanForm({
  plan,
  pending,
  run,
  msg,
  onDone,
}: {
  plan?: IfThenPlan;
  pending: boolean;
  run: Run;
  msg: (s: string) => ReactNode;
  onDone?: () => void;
}) {
  const hydrated = useHydrated();
  const scope = plan ? `plano-${plan.id}` : "novo-plano";
  const [f, setF] = useState({
    trigger: plan?.trigger_text ?? "",
    activity: plan?.alternative_activity ?? "",
    minutes: plan ? String(plan.duration_minutes) : "15",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      aria-label={plan ? "Editar plano se-então" : "Novo plano se-então"}
      className={
        plan
          ? "flex flex-col gap-3"
          : "flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 shadow-paper sm:p-5"
      }
      onSubmit={(e) => {
        e.preventDefault();
        run(
          scope,
          () => savePlan({ id: plan?.id, ...f }),
          plan ? "Plano salvo." : "Plano criado.",
          () =>
            plan
              ? onDone?.()
              : setF({ trigger: "", activity: "", minutes: "15" }),
        );
      }}
    >
      <TextField
        label="Se…"
        hint="Ex.: se eu chegar cansado do trabalho"
        value={f.trigger}
        onChange={set("trigger")}
        maxLength={200}
        required
      />
      <TextField
        label="Então…"
        hint="Ex.: faço 10 minutos de revisão"
        value={f.activity}
        onChange={set("activity")}
        maxLength={200}
        required
      />
      <TextField
        label="Duração (minutos)"
        type="number"
        inputMode="numeric"
        min={1}
        max={60}
        value={f.minutes}
        onChange={set("minutes")}
        className="max-w-[12rem]"
        required
      />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          size={plan ? "sm" : "md"}
          loading={pending}
          disabled={!hydrated}
        >
          {plan ? "Salvar plano" : "Criar plano"}
        </Button>
        {plan && (
          <Button type="button" size="sm" variant="secondary" onClick={onDone}>
            Voltar
          </Button>
        )}
      </div>
      <div aria-live="polite">{msg(scope)}</div>
    </form>
  );
}
