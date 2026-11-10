"use client";

import { clsx } from "clsx";
import { Check, Circle, FlaskConical, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryCorrection, startRewrite } from "@/lib/essay/correction-actions";
import type { CorrectionAnnotation, CorrectionView } from "@/lib/essay/correction";
import { PenStroke } from "./pen-stroke";

const ELEMENTS: [string, string][] = [
  ["agente", "Agente"],
  ["acao", "Ação"],
  ["meio", "Meio ou modo"],
  ["finalidade", "Finalidade"],
  ["detalhamento", "Detalhamento"],
];

type Note = CorrectionAnnotation & { slot: string };

/** Trechos do parágrafo, com as anotações (sem sobreposição: a primeira vence). */
function segments(text: string, notes: Note[]) {
  const sorted = [...notes].sort((a, b) => a.start_utf16! - b.start_utf16!);
  const out: { text: string; note?: Note }[] = [];
  let at = 0;
  for (const n of sorted) {
    if (n.start_utf16! < at) continue;
    if (n.start_utf16! > at) out.push({ text: text.slice(at, n.start_utf16!) });
    out.push({ text: text.slice(n.start_utf16!, n.end_utf16!), note: n });
    at = n.end_utf16!;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

export function CorrectionResult({ view }: { view: CorrectionView }) {
  const { job, result, evaluations } = view;
  const isTest = evaluations.some((e) => e.isTest);
  const router = useRouter();

  // Enquanto a fila trabalha, a tela se atualiza sozinha (sem mexer no texto).
  useEffect(() => {
    if (!job || job.status === "pronto" || job.status === "limite_atingido" || (job.status === "nova_tentativa" && !job.autoRetry)) return;
    const t = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(t);
  }, [job, router]);

  return (
    <div className="flex flex-col gap-10">
      {isTest && (
        <p role="note" className="flex items-start gap-3 rounded-card bg-mark-yellow px-4 py-3 t-ui text-on-mark">
          <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0" />
          Teste da integração: estas notas vêm do avaliador de teste e servem só para conferir o fluxo. Não são uma correção.
        </p>
      )}
      <Progress view={view} />
      {result && <Verdict view={view} />}
      {evaluations.length > 0 && <Reading view={view} />}
      {evaluations.length > 0 && <Intervention view={view} />}
      {job?.status === "pronto" && <Evolution view={view} />}
    </div>
  );
}

function Progress({ view }: { view: CorrectionView }) {
  const { job, evaluations, rule } = view;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!job) return <p className="t-reading text-ink-2">Esta redação ainda não foi enviada para correção.</p>;
  const has = (s: string) => evaluations.some((e) => e.slot === s);
  const needC = job.step === "avaliador_c" || has("C");
  const steps = [
    { key: "A", label: "Avaliador A", done: has("A"), active: job.step === "avaliador_a" },
    { key: "B", label: "Avaliador B", done: has("B"), active: job.step === "avaliador_b" },
    {
      key: "C",
      label: needC ? "Avaliador C (houve discrepância)" : "Avaliador C, só se houver discrepância",
      done: has("C"),
      active: job.step === "avaliador_c",
      skipped: job.step === "concluido" && !has("C"),
    },
    { key: "R", label: "Resultado", done: job.status === "pronto", active: false },
  ];
  const stuck = job.status === "limite_atingido" || (job.status === "nova_tentativa" && !job.autoRetry);
  const stateText =
    job.status === "pronto"
      ? null
      : job.status === "limite_atingido"
        ? "Parada: o orçamento de correção do mês acabou. Ela continua guardada e pode ser pedida de novo."
        : job.status === "nova_tentativa"
          ? job.autoRetry
            ? "Uma etapa falhou e será tentada de novo automaticamente."
            : `Parada depois de ${job.attempts} tentativas sem sucesso. Você pode pedir de novo.`
          : job.status === "em_analise"
            ? "Em análise agora."
            : "Na fila. As avaliações são independentes: nenhum avaliador vê a nota do outro.";
  return (
    <section aria-labelledby="andamento" className="flex flex-col gap-4">
      <h2 id="andamento" className="t-kicker">
        Andamento
      </h2>
      <ol className="flex flex-col gap-0 sm:flex-row sm:gap-0">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-3 py-1.5 sm:flex-col sm:items-start sm:gap-2">
            <span className="flex items-center gap-2 sm:w-full">
              <span
                className={clsx(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  s.done ? "border-ink bg-ink text-background" : s.active ? "border-primary text-link" : "border-line-subtle text-ink-2",
                )}
                aria-hidden
              >
                {s.done ? <Check className="size-4" strokeWidth={2.5} /> : s.skipped ? <Minus className="size-4" /> : <Circle className="size-2.5" fill="currentColor" />}
              </span>
              {i < steps.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-line-subtle sm:block" />}
            </span>
            <span className={clsx("t-meta", s.done || s.active ? "text-ink" : "text-ink-2")}>
              {s.label}
              <span className="sr-only">{s.done ? ": feito" : s.active ? ": em andamento" : s.skipped ? ": não foi necessário" : ": pendente"}</span>
            </span>
          </li>
        ))}
      </ol>
      {stateText && (
        <p role="status" className="t-ui">
          {stateText}
        </p>
      )}
      {rule && (
        <p className="max-w-2xl t-meta text-ink-2">
          Regra {rule.version}: a terceira avaliação acontece quando A e B diferem em mais de {rule.totalGt} pontos no total ou mais de{" "}
          {rule.competencyGt} em alguma competência. {rule.sourceNote}
        </p>
      )}
      {stuck && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await retryCorrection({ essayId: view.essayId, jobId: job.id });
                setMsg(r.ok ? "Pedido de novo." : r.message);
                router.refresh();
              })
            }
          >
            Pedir correção de novo
          </Button>
          <span aria-live="polite" className="t-meta">
            {msg}
          </span>
        </div>
      )}
    </section>
  );
}

function Verdict({ view }: { view: CorrectionView }) {
  const r = view.result!;
  const calibrated = r.status === "calibrado" && r.calibratedLower !== null && r.calibratedUpper !== null;
  return (
    <section aria-labelledby="resultado" className="flex flex-col gap-3 border-y border-line-subtle py-8">
      <h2 id="resultado" className="t-kicker">
        {calibrated ? "Faixa calibrada" : "Divergência entre as avaliações"}
      </h2>
      <p className="font-display text-[44px] leading-none tabular text-ink sm:text-[64px]">
        {calibrated ? r.calibratedLower : r.lower}
        <span className="px-3 text-ink-2">a</span>
        {calibrated ? r.calibratedUpper : r.upper}
      </p>
      <p className="max-w-2xl t-reading text-ink-2">
        {calibrated
          ? "Faixa ajustada pela calibração registrada."
          : `Menor e maior total entre as ${r.count ?? view.evaluations.length} avaliações. Ainda não há calibração com notas humanas, então isto não é uma faixa de confiança nem uma previsão da sua nota no Enem.`}
      </p>
      {r.center !== null && (
        <p className="t-meta text-ink-2">
          Centro interno: <span className="tabular text-ink">{r.center}</span> ({r.count === 3 ? "mediana das três" : "média das duas"}, regra da plataforma).
          {r.discrepancy ? " A e B divergiram além da regra; por isso houve a terceira avaliação." : ""}
        </p>
      )}
    </section>
  );
}

function Reading({ view }: { view: CorrectionView }) {
  const [comp, setComp] = useState(view.dimensions[0]?.code ?? "C1");
  const [selected, setSelected] = useState<string | null>(null);
  const scope = useRef<HTMLDivElement>(null);
  const notes = useMemo(
    () =>
      view.evaluations.flatMap((e) =>
        e.annotations.filter((a) => a.competency === comp && !a.absent && a.paragraph_id).map((a) => ({ ...a, slot: e.slot })),
      ),
    [view.evaluations, comp],
  );
  const absent = view.evaluations.flatMap((e) =>
    e.annotations.filter((a) => a.competency === comp && a.absent && !a.intervention_element).map((a) => ({ ...a, slot: e.slot })),
  );
  return (
    <section aria-labelledby="leitura" className="flex flex-col gap-5">
      <h2 id="leitura" className="t-section">
        Notas por competência
      </h2>
      <div role="tablist" aria-label="Competência" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {view.dimensions.map((d) => {
          const on = d.code === comp;
          return (
            <button
              key={d.code}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => {
                setComp(d.code);
                setSelected(null);
              }}
              className={clsx(
                "flex min-h-11 shrink-0 flex-col items-start rounded-control px-3 py-1.5 text-left",
                on ? "bg-mark-yellow text-on-mark" : "text-ink hover:bg-surface-subtle",
              )}
            >
              <span className="t-ui">{d.code}</span>
              <span className="t-meta tabular">
                {view.evaluations.map((e) => `${e.slot} ${e.scores[d.code] ?? "–"}`).join(" · ")}
              </span>
            </button>
          );
        })}
      </div>
      <p className="max-w-3xl t-meta text-ink-2">{view.dimensions.find((d) => d.code === comp)?.title}</p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div ref={scope} className="relative rounded-panel border border-line-subtle bg-surface px-5 py-6 sm:px-8">
          {view.paragraphs.map((p) => (
            <p key={p.id} className="mb-4 t-reading text-ink last:mb-0">
              {segments(
                p.text,
                notes.filter((n) => n.paragraph_id === p.id),
              ).map((s, i) =>
                s.note ? (
                  <mark
                    key={i}
                    data-anchor={s.note.id}
                    className={clsx("rounded-sm bg-mark-yellow px-0.5 text-on-mark", selected === s.note.id && "outline-2 outline-offset-1 outline-link")}
                  >
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </p>
          ))}
          <PenStroke scopeRef={scope} anchor={selected} strokeKey={`${comp}-${selected}`} />
        </div>
        <aside aria-label={`Comentários de ${comp}`} className="flex flex-col gap-2">
          {notes.length === 0 && absent.length === 0 && (
            <p className="t-meta text-ink-2">Nenhum trecho anotado nesta competência.</p>
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={selected === n.id}
              onClick={() => setSelected(selected === n.id ? null : n.id)}
              className={clsx(
                "flex flex-col gap-1 rounded-card border px-3 py-2.5 text-left",
                selected === n.id ? "border-ink bg-surface" : "border-line-subtle hover:border-line",
              )}
            >
              <span className="t-meta text-ink-2">Avaliador {n.slot}</span>
              <span className="t-ui text-ink">{n.comment}</span>
            </button>
          ))}
          {absent.map((n) => (
            <p key={n.id} className="rounded-card border border-dashed border-line px-3 py-2.5 t-meta text-ink">
              <span className="text-ink-2">Avaliador {n.slot} · sem trecho: </span>
              {n.comment}
            </p>
          ))}
        </aside>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {view.evaluations.map((e) => (
          <div key={e.id} className="border-l-2 border-line pl-4">
            <p className="t-meta text-ink-2">
              Avaliador {e.slot} · total <span className="tabular text-ink">{e.total}</span>
            </p>
            {e.feedback && <p className="mt-1 t-meta text-ink">{e.feedback}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Intervention({ view }: { view: CorrectionView }) {
  return (
    <section aria-labelledby="intervencao" className="flex flex-col gap-3">
      <h2 id="intervencao" className="t-section">
        Proposta de intervenção
      </h2>
      <p className="t-meta text-ink-2">Os cinco elementos que a competência 5 procura, como cada avaliador os encontrou no texto.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse t-meta">
          <thead>
            <tr className="border-b border-line-subtle text-left text-ink-2">
              <th scope="col" className="py-2 pr-4 font-medium">
                Elemento
              </th>
              {view.evaluations.map((e) => (
                <th key={e.id} scope="col" className="py-2 pr-4 font-medium">
                  Avaliador {e.slot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ELEMENTS.map(([k, label]) => (
              <tr key={k} className="border-b border-line-subtle align-top">
                <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">
                  {label}
                </th>
                {view.evaluations.map((e) => {
                  const v = e.intervention?.[k] ?? null;
                  return (
                    <td key={e.id} className="py-2 pr-4 text-ink">
                      {e.intervention === null ? (
                        <span className="text-ink-2">sem registro</span>
                      ) : (
                        (v ?? <span className="text-ink-2">não encontrado</span>)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Evolution({ view }: { view: CorrectionView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section aria-labelledby="evolucao" className="flex flex-col gap-4 border-t border-line-subtle pt-8">
      <h2 id="evolucao" className="t-section">
        Reescrita e evolução
      </h2>
      <p className="max-w-2xl t-meta text-ink-2">
        A reescrita parte do texto enviado e vira uma versão nova; esta correção continua guardada. Cada versão enviada tem a própria correção.
      </p>
      {view.history.length > 0 && (
        <ol className="flex flex-col">
          {view.history.map((h, i) => (
            <li key={h.versionId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line-subtle py-2">
              <span className="w-24 t-ui">Versão {i + 1}</span>
              <span className="t-meta text-ink-2">{new Date(h.submittedAt).toLocaleDateString("pt-BR")}</span>
              <span className="t-ui tabular">{h.lower !== null ? `${h.lower} a ${h.upper}` : "sem resultado ainda"}</span>
              {h.isTest && <span className="rounded-full bg-mark-yellow px-2 py-0.5 t-meta text-on-mark">teste</span>}
              {h.current && <span className="t-meta text-ink-2">(esta)</span>}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await startRewrite({ essayId: view.essayId });
              if (!r.ok) return setMsg(r.message);
              router.push(`/redacao/escrever/${view.essayId}`);
            })
          }
        >
          {view.hasDraft ? "Continuar a reescrita" : "Reescrever"}
        </Button>
        <span aria-live="polite" className="t-meta">
          {msg}
        </span>
      </div>
    </section>
  );
}
