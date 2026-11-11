"use client";

import { Archive, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addCourseGoal, archiveCourseGoal } from "@/lib/goals/actions";
import { neededIn, PART_LABEL, PARTS, weightedAverage, weightOf, type CourseGoal, type Part } from "@/lib/goals/course";

const input = "min-h-11 w-full rounded-control border border-line bg-surface px-3 t-ui text-ink";
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const store = (id: string) => `resolve:meta-notas:${id}`;

/** Régua 0–1000 com a nota de corte (traço azul) e a sua média (ponto em tinta). Sem animação: responde ao que você digita. */
function Ruler({ cutoff, average }: { cutoff: number | null; average: number | null }) {
  const at = (v: number) => `${Math.max(0, Math.min(100, v / 10)).toFixed(1)}%`;
  return (
    <div className="relative mt-8 mb-6 h-px bg-line" aria-hidden>
      {[0, 250, 500, 750, 1000].map((t) => (
        <span key={t} className="absolute top-2 -translate-x-1/2 t-meta tabular text-ink-2" style={{ left: at(t) }}>
          {t}
        </span>
      ))}
      {cutoff !== null && (
        <span className="absolute -top-5 h-5 w-0.5 -translate-x-1/2 bg-primary" style={{ left: at(cutoff) }}>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap t-meta text-ink">corte</span>
        </span>
      )}
      {average !== null && <span className="absolute -top-2 size-4 -translate-x-1/2 rounded-full bg-ink ring-4 ring-surface" style={{ left: at(average) }} />}
    </div>
  );
}

function GoalCard({ goal }: { goal: CourseGoal }) {
  const router = useRouter();
  const [scores, setScores] = useState<Partial<Record<Part, number>>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(store(goal.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura as notas digitadas neste aparelho
      if (raw) setScores(JSON.parse(raw));
    } catch {
      /* armazenamento indisponível: começa vazio */
    }
  }, [goal.id]);
  const set = (p: Part, v: string) => {
    const n = v === "" ? undefined : Math.max(0, Math.min(1000, Number(v.replace(",", "."))));
    const next = { ...scores, [p]: n };
    if (n === undefined) delete next[p];
    setScores(next);
    try {
      localStorage.setItem(store(goal.id), JSON.stringify(next));
    } catch {
      /* sem armazenamento: só nesta tela */
    }
  };
  const avg = weightedAverage(scores, goal);
  const missing = PARTS.filter((p) => scores[p] === undefined);
  const gap = avg !== null && goal.cutoff !== null ? avg - goal.cutoff : null;
  const solveFor = missing.length === 1 ? missing[0]! : null;
  const need = solveFor ? neededIn(solveFor, scores, goal) : null;
  return (
    <article className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface p-5 shadow-paper sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-kicker">{goal.institution}</p>
          <h2 className="mt-1 font-display text-[30px] leading-tight text-ink">{goal.course}</h2>
          {goal.modality && <p className="t-meta text-ink-2">{goal.modality}</p>}
        </div>
        <div className="text-right">
          <p className="t-meta text-ink-2">Nota de corte</p>
          <p className="font-display text-[34px] leading-none tabular text-ink">{goal.cutoff === null ? "—" : fmt(goal.cutoff)}</p>
        </div>
      </header>
      <p className="t-meta text-ink-2">
        {goal.source ? <>Fonte (informada por você): {goal.source}</> : "Sem nota de corte nem pesos informados."}
        {goal.weights ? "" : " Sem pesos informados: média simples."}
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 t-ui text-ink">Suas notas para simular</legend>
        <p className="-mt-1 mb-1 t-meta text-ink-2">
          Use notas que você conhece, como as de um Enem que já fez. O Resolve ainda não estima sua nota (sem parâmetros oficiais de TRI).
          Ficam só neste aparelho.
        </p>
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
          {PARTS.map((p) => (
            <label key={p} className="flex flex-col gap-1 t-meta text-ink-2">
              <span>
                {PART_LABEL[p]} <span className="tabular">· peso {String(weightOf(goal, p)).replace(".", ",")}</span>
              </span>
              <input
                inputMode="decimal"
                value={scores[p] ?? ""}
                onChange={(e) => set(p, e.target.value)}
                placeholder="0–1000"
                className={`${input} tabular`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <Ruler cutoff={goal.cutoff} average={avg} />

      <div aria-live="polite" className="t-reading text-ink">
        {avg !== null ? (
          <p>
            Média ponderada: <strong className="tabular">{fmt(avg)}</strong>
            {gap !== null && (
              <span className="text-ink-2"> · {gap >= 0 ? `${fmt(gap)} acima do corte` : `${fmt(-gap)} abaixo do corte`}</span>
            )}
          </p>
        ) : need && solveFor ? (
          <p>
            Para chegar ao corte com essas quatro notas, faltaria{" "}
            {need.needed > 1000 ? (
              <>mais de 1000 em {PART_LABEL[solveFor]}: só essa parte não basta.</>
            ) : need.needed <= 0 ? (
              <>qualquer nota em {PART_LABEL[solveFor]}: as outras já bastam.</>
            ) : (
              <>
                <strong className="tabular">{fmt(need.needed)}</strong> em {PART_LABEL[solveFor]}.
              </>
            )}
          </p>
        ) : (
          <p className="t-meta text-ink-2">Preencha as cinco notas (ou quatro, para ver quanto falta na quinta).</p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="self-start"
        loading={pending}
        icon={<Archive aria-hidden className="size-4" />}
        onClick={() =>
          start(async () => {
            const r = await archiveCourseGoal({ id: goal.id });
            if (r.ok) router.refresh();
          })
        }
      >
        Arquivar meta
      </Button>
    </article>
  );
}

function NewGoal({ open }: { open: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <details open={open} className="group rounded-panel border border-line-subtle bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-5 t-ui text-ink">
        <Plus aria-hidden className="size-4" /> Nova meta de curso
      </summary>
      <form
        className="flex flex-col gap-4 border-t border-line-subtle p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const num = (k: string) => {
            const v = String(f.get(k) ?? "").replace(",", ".").trim();
            return v === "" ? undefined : Number(v);
          };
          const weights = Object.fromEntries(PARTS.map((p) => [p, num(`w-${p}`)]).filter(([, v]) => v !== undefined));
          start(async () => {
            setError(null);
            const r = await addCourseGoal({
              course: f.get("course"),
              institution: f.get("institution"),
              modality: String(f.get("modality") ?? "") || null,
              cutoff: num("cutoff") ?? null,
              weights: Object.keys(weights).length ? weights : null,
              source: String(f.get("source") ?? "") || null,
            });
            if (r.ok) {
              (e.target as HTMLFormElement).reset();
              router.refresh();
            } else setError(r.message);
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Curso
            <input name="course" required minLength={2} maxLength={120} className={input} />
          </label>
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Instituição e campus
            <input name="institution" required minLength={2} maxLength={160} className={input} />
          </label>
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Modalidade (opcional)
            <input name="modality" maxLength={120} placeholder="ex.: ampla concorrência" className={input} />
          </label>
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Nota de corte (opcional)
            <input name="cutoff" inputMode="decimal" placeholder="0–1000" className={`${input} tabular`} />
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="t-meta text-ink-2">Pesos por área (opcional; em branco vale 1)</legend>
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
            {PARTS.map((p) => (
              <label key={p} className="flex flex-col gap-1 t-meta text-ink-2">
                {PART_LABEL[p]}
                <input name={`w-${p}`} inputMode="decimal" placeholder="1" className={`${input} tabular`} />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 t-meta text-ink-2">
          Fonte (obrigatória com nota de corte ou pesos)
          <input name="source" maxLength={500} placeholder="ex.: Sisu 2026, 1ª edição, nota de corte do último dia, página do curso" className={input} />
        </label>
        <Button type="submit" loading={pending} className="self-start">
          Salvar meta
        </Button>
        <div aria-live="polite">{error && <p role="alert" className="t-meta">{error}</p>}</div>
      </form>
    </details>
  );
}

export function CourseGoals({ goals }: { goals: CourseGoal[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} />
      ))}
      {goals.length < 3 && <NewGoal open={goals.length === 0} />}
    </div>
  );
}
