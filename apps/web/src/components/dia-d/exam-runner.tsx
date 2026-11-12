"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { PromptReader } from "@/components/essay/prompt-reader";
import { QuestionView } from "@/components/question/question-view";
import { Button } from "@/components/ui/button";
import { AnswerCard } from "./answer-card";
import { saveDiaD } from "@/lib/dia-d/actions";
import { clockLabel, type ExamAction, type ExamRun, type Letter } from "@/lib/dia-d/types";
import { ExamReplay } from "./exam-replay";

type View = "questao" | "cartao" | "redacao" | "replay";
type Command = { id: string; action: ExamAction };

export function ExamRunner({ run }: { run: ExamRun }) {
  const router = useRouter();
  const ended = !!run.ended_at;
  const [view, setView] = useState<View>(ended ? "cartao" : "questao");
  const [items, setItems] = useState(run.items);
  const [position, setPosition] = useState(run.position);
  const [essay, setEssay] = useState(run.essay);
  const [savedEssay, setSavedEssay] = useState(run.essay);
  const [elapsed, setElapsed] = useState(0);
  const [eliminated, setEliminated] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<Command | null>(null);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [syncRequired, setSyncRequired] = useState(false);
  const revision = useRef(run.revision);
  const busyRef = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const remaining = Date.parse(run.deadline_at) - Date.parse(run.server_time) - elapsed;
  const expired = !ended && remaining <= 0;
  const locked = busy || !!retry || syncRequired || expired;
  const item = items.find((entry) => entry.position === position);
  const index = items.findIndex((entry) => entry.position === position);
  const filled = items.filter((entry) => entry.card).length;
  const matches = items.filter((entry) => entry.correct && entry.card === entry.correct).length;
  const graded = items.filter((entry) => entry.correct).length;
  const differences = items.filter((entry) => entry.work && entry.work !== entry.card).length;
  const blank = items.filter((entry) => !entry.annulled && !entry.card).length;
  const unsaved = essay !== savedEssay;

  useEffect(() => {
    if (ended) return;
    const mounted = Date.now();
    const update = () => setElapsed(Date.now() - mounted);
    const timer = window.setInterval(update, 500);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [ended, run.server_time]);

  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  const autosave = useEffectEvent(() => record({ kind: "redacao", essay }));
  useEffect(() => {
    if (ended || locked || !run.prompt_id || essay === savedEssay) return;
    const timer = window.setTimeout(() => autosave(), 900);
    return () => window.clearTimeout(timer);
  }, [ended, locked, run.prompt_id, essay, savedEssay]);

  function show(next: View) {
    setView(next);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function apply(action: ExamAction) {
    if (action.kind === "abriu") {
      setPosition(action.position);
      setEliminated(new Set());
      show("questao");
    } else if (action.kind === "marcou" || action.kind === "transcreveu") {
      const field = action.kind === "marcou" ? "work" : "card";
      setItems((list) => list.map((entry) => entry.position === action.position ? { ...entry, [field]: action.letter } : entry));
    } else if (action.kind === "redacao") {
      setSavedEssay(action.essay);
      setMessage("Redação salva.");
    } else if (action.kind === "entregou") {
      setSyncRequired(true);
      router.refresh();
    }
  }

  async function send(command: Command) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await saveDiaD({ ...command.action, run: run.id, action: command.id, revision: revision.current });
      if (result === "error") {
        setRetry(command);
        setMessage("Não foi possível confirmar o salvamento. Tente novamente.");
        return;
      }
      setRetry(null);
      if (result === "saved") {
        revision.current++;
        apply(command.action);
      } else {
        setSyncRequired(true);
        setMessage(result === "closed" ? "O prazo terminou. Atualizando o resultado." : "O simulado mudou em outra aba. Atualizando a versão salva.");
        router.refresh();
      }
    } catch {
      setRetry(command);
      setMessage("A conexão caiu antes da confirmação. Tente salvar de novo.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function record(action: ExamAction) {
    if (!locked && !ended) void send({ id: crypto.randomUUID(), action });
  }

  function open(next: number) {
    if (ended || next === position) {
      setPosition(next);
      show("questao");
    } else record({ kind: "abriu", position: next });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-subtle bg-background py-2">
        <p className="t-ui">{filled}/{items.length} no cartão</p>
        {ended ? <p className="t-ui font-semibold">{matches}/{graded} acertos válidos</p> : (
          <p className="t-metric tabular" role="timer" aria-live="off" aria-label="Tempo restante">{clockLabel(remaining)}</p>
        )}
        <nav aria-label="Caderno e cartão" className="flex flex-wrap gap-1">
          <Button size="sm" variant={view === "questao" ? "secondary" : "ghost"} aria-pressed={view === "questao"} onClick={() => show("questao")}>Caderno</Button>
          <Button size="sm" variant={view === "cartao" ? "secondary" : "ghost"} aria-pressed={view === "cartao"} onClick={() => show("cartao")}>Cartão-resposta</Button>
          {run.prompt_id && <Button size="sm" variant={view === "redacao" ? "secondary" : "ghost"} aria-pressed={view === "redacao"} onClick={() => show("redacao")}>Redação</Button>}
          {ended && <Button size="sm" variant={view === "replay" ? "secondary" : "ghost"} aria-pressed={view === "replay"} onClick={() => show("replay")}>Replay</Button>}
        </nav>
      </div>
      {(message || retry || syncRequired || expired) && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-card border border-line-subtle p-3 t-meta">
          {message || (expired ? "O prazo terminou. Carregando o cartão entregue." : "")}
          {retry && <Button size="sm" variant="secondary" loading={busy} onClick={() => void send(retry)}>Tentar salvar de novo</Button>}
          {(syncRequired || expired) && <Button size="sm" variant="secondary" onClick={() => router.refresh()}>Atualizar simulado</Button>}
        </div>
      )}
      {view === "questao" && item && (
        <section>
          <h2 ref={heading} tabIndex={-1} className="mb-3 t-section">Questão {position}</h2>
          {item.question ? (
            <QuestionView question={item.question} answer={{
              value: ended ? item.card : item.work,
              onValueChange: (letter) => record({ kind: "marcou", position, letter: letter as Letter }),
              eliminated,
              onToggleEliminate: (key) => setEliminated((previous) => {
                const next = new Set(previous);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              }),
              confirmed: ended || locked,
              reveal: ended && item.correct ? { correctKey: item.correct } : null,
            }} />
          ) : item.annulled ? (
            <p className="t-meta text-ink-2">
              Questão anulada pelo Inep. A posição foi mantida no cartão.
              {" "}<a className="underline" href={run.booklet.source} target="_blank" rel="noreferrer">Ver caderno oficial</a>
            </p>
          ) : <p className="t-meta text-ink-2">O conteúdo desta questão está indisponível no banco.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={(!ended && locked) || index === 0} onClick={() => open(items[index - 1]!.position)}>Anterior</Button>
            <Button variant="secondary" disabled={(!ended && locked) || index === items.length - 1} onClick={() => open(items[index + 1]!.position)}>Próxima</Button>
            {!ended && <Button variant="ghost" disabled={locked || !item.work} onClick={() => record({ kind: "marcou", position, letter: null })}>Limpar marcação</Button>}
          </div>
          {!ended && <p className="mt-3 t-meta text-ink-2">Marcações no caderno são de trabalho. Transcreva a resposta no cartão para ela valer na entrega.</p>}
        </section>
      )}
      {view === "cartao" && (
        <section>
          <h2 ref={heading} tabIndex={-1} className="t-section">Cartão-resposta</h2>
          <p className="my-3 t-meta text-ink-2">
            {ended ? `${blank} questões válidas em branco. A nota TRI está indisponível.` : `${differences} marcações do caderno ainda divergem do cartão.`}
          </p>
          {!ended && (
            <div className="mb-4">
              {confirm ? (
                <div className="flex flex-col items-start gap-2 rounded-card border border-line-subtle p-3">
                  <p className="t-ui">Entregar com {blank} questões válidas em branco e {differences} divergências?</p>
                  {unsaved && <p className="t-meta">Sua redação tem alterações por salvar. Salve antes de entregar.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={locked || unsaved} onClick={() => record({ kind: "entregou" })}>Confirmar entrega</Button>
                    <Button variant="ghost" onClick={() => setConfirm(false)}>Voltar ao cartão</Button>
                  </div>
                </div>
              ) : <Button disabled={locked} onClick={() => setConfirm(true)}>Entregar simulado</Button>}
            </div>
          )}
          <AnswerCard
            items={items.map((e) => ({ position: e.position, work: (e.work ?? null) as Letter | null, card: (e.card ?? null) as Letter | null, annulled: Boolean(e.annulled), correct: (e.correct ?? null) as Letter | null }))}
            ended={ended}
            locked={locked}
            onMark={(position, letter) => record({ kind: "transcreveu", position, letter })}
            onOpen={open}
          />
        </section>
      )}
      {view === "redacao" && (
        <section className="flex max-w-3xl flex-col gap-4">
          <h2 ref={heading} tabIndex={-1} className="t-section">{run.prompt?.title ?? "Redação"}</h2>
          {run.prompt && <PromptReader prompt={run.prompt} headingLevel={3} />}
          <label htmlFor="dia-d-texto" className="t-ui font-semibold">{ended ? "Texto entregue" : "Sua redação"}</label>
          <textarea id="dia-d-texto" className="min-h-64 rounded-panel border border-line bg-surface p-4 t-reading" maxLength={30000}
            value={essay} onChange={(e) => setEssay(e.target.value)} readOnly={ended || expired || syncRequired} />
          {ended ? <p className="t-meta text-ink-2">Correção da redação indisponível neste resultado.</p> : (
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={locked || !unsaved} onClick={() => record({ kind: "redacao", essay })}>Salvar redação</Button>
              <p className="t-meta text-ink-2">{unsaved ? "Alterações por salvar." : "O texto salvo fica guardado ao sair."}</p>
            </div>
          )}
        </section>
      )}
      {view === "replay" && ended && <ExamReplay run={run} open={open} />}
    </div>
  );
}
