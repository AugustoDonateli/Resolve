"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useReduced } from "@/components/prefs/prefs";
import { QuestionBlocks } from "@/components/question/question-view";
import { Button } from "@/components/ui/button";
import { approveAnnotation, returnAnnotation } from "@/lib/editor/annotation-actions";
import {
  DEPENDENCY,
  adjustProblems,
  evidenceMarks,
  nextPending,
  rowLabel,
  stepsFromText,
  type AnnotationPayload,
  type AnnotationReview,
  type AreaCode,
  type QueueRow,
  type ReviewOptions,
} from "@/lib/editor/annotation-types";
import { ring, seedOf } from "@/lib/ink/paths";
import { AREA_LABEL } from "@/lib/study/question-types";

type Mode = "ver" | "ajustar" | "devolver";

const LANG = { ingles: "inglês", espanhol: "espanhol" } as const;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const field = "min-h-11 w-full rounded-control border border-line bg-surface px-3 t-ui font-normal text-ink";
const SHORTCUTS_KEY = "resolve:conferencia:atalhos";

// Atalhos ligados ou não: preferência deste aparelho (vale mesmo sem armazenamento disponível).
let shortcutsChoice: boolean | null = null;
const shortcutsListeners = new Set<() => void>();
const subscribeShortcuts = (cb: () => void) => {
  shortcutsListeners.add(cb);
  return () => void shortcutsListeners.delete(cb);
};
function readShortcuts() {
  if (shortcutsChoice !== null) return shortcutsChoice;
  try {
    return window.localStorage.getItem(SHORTCUTS_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeShortcuts(on: boolean) {
  shortcutsChoice = on;
  try {
    window.localStorage.setItem(SHORTCUTS_KEY, on ? "1" : "0");
  } catch {}
  shortcutsListeners.forEach((l) => l());
}

/**
 * Conferência relâmpago das anotações: a questão como o aluno vê (com a evidência em marca-texto) ao
 * lado da anotação proposta. Aprovar, ajustar ou devolver, com atalhos de teclado; a decisão é gravada
 * antes de qualquer gesto na tela, e a próxima ficha já foi buscada enquanto a atual era lida.
 */
export function AnnotationReviewer({
  area,
  rows: initialRows,
  startIndex,
  initial,
  options,
}: {
  area: AreaCode;
  rows: QueueRow[];
  startIndex: number;
  initial: AnnotationReview;
  options: ReviewOptions;
}) {
  const reduced = useReduced();
  const uid = useId();
  const [rows, setRows] = useState(initialRows);
  const [index, setIndex] = useState(startIndex);
  const [review, setReview] = useState<AnnotationReview | null>(initial);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("ver");
  const [busy, setBusy] = useState<null | "aprovar" | "devolver">(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [stamping, setStamping] = useState(false);
  const shortcuts = useSyncExternalStore(subscribeShortcuts, readShortcuts, () => true);
  const [returnNote, setReturnNote] = useState("");

  const cache = useRef(new Map<string, Promise<AnnotationReview | null>>([[initial.id, Promise.resolve(initial)]]));
  const request = useRef(0);
  const armedAt = useRef(0);
  const rowsRef = useRef(rows);
  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const load = useCallback((id: string) => {
    const hit = cache.current.get(id);
    if (hit) return hit;
    const p = fetch(`/editor/anotacoes/ficha?id=${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AnnotationReview>) : null))
      .catch(() => null)
      .then((r) => {
        if (!r) cache.current.delete(id);
        return r;
      });
    cache.current.set(id, p);
    return p;
  }, []);

  const goTo = useCallback(
    async (i: number) => {
      const row = rowsRef.current[i];
      if (!row) return;
      const token = ++request.current;
      setMode("ver");
      setProblem(null);
      setReturnNote("");
      setIndex(i);
      setLoading(true);
      const next = await load(row.id);
      if (request.current !== token) return;
      setReview(next);
      setLoading(false);
      armedAt.current = performance.now() + 600;
      window.history.replaceState(null, "", `/editor/anotacoes?area=${area}&q=${row.id}`);
      const top = topRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) window.scrollBy({ top: top - 12 });
      headingRef.current?.focus({ preventScroll: true });
    },
    [area, load],
  );

  // Enquanto a ficha atual é lida, busca a próxima por conferir e a vizinha.
  useEffect(() => {
    const ahead = [nextPending(rows, index), index + 1];
    for (const i of ahead) if (i >= 0 && rows[i]) void load(rows[i].id);
  }, [rows, index, load]);

  const row = rows[index]!;
  const status = row.status;
  const pending = rows.filter((r) => r.status === "proposta").length;
  const open = status === "proposta" && Boolean(review) && !loading;

  const finish = useCallback(
    (what: "aprovada" | "devolvida", adjusted: boolean) => {
      const at = index;
      const nextRows = rowsRef.current.map((r, i) => (i === at ? { ...r, status: what } : r));
      rowsRef.current = nextRows;
      setRows(nextRows);
      setLast(`${rowLabel(nextRows[at]!)} ${what}`);
      setMode("ver");
      if (adjusted) cache.current.delete(nextRows[at]!.id);
      const next = nextPending(nextRows, at);
      const advance = () => {
        setStamping(false);
        if (next >= 0) void goTo(next);
      };
      if (what === "aprovada" && !reduced && next >= 0) {
        setStamping(true);
        timer.current = setTimeout(advance, 520);
      } else advance();
    },
    [goTo, index, reduced],
  );

  const approve = useCallback(
    async (payload?: AnnotationPayload, note?: string) => {
      if (!review || busy || stamping || status !== "proposta") return;
      setBusy("aprovar");
      setProblem(null);
      const res = await approveAnnotation({ id: review.id, payload, note: note || undefined });
      setBusy(null);
      if (!res.ok) return setProblem(res.problem);
      finish("aprovada", Boolean(payload));
    },
    [busy, finish, review, stamping, status],
  );

  const sendBack = useCallback(async () => {
    if (!review || busy || status !== "proposta") return;
    if (returnNote.trim().length < 10) return setProblem("Diga o que precisa mudar (10 caracteres ou mais).");
    setBusy("devolver");
    setProblem(null);
    const res = await returnAnnotation({ id: review.id, note: returnNote.trim() });
    setBusy(null);
    if (!res.ok) return setProblem(res.problem);
    finish("devolvida", false);
  }, [busy, finish, returnNote, review, status]);

  // Atalhos: uma tecla por decisão. Não valem enquanto se digita, com modificador, com tecla presa, nem
  // nos primeiros instantes de uma ficha nova (aprovar é definitivo: evita aprovar a próxima sem ler).
  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && mode !== "ver") {
        e.preventDefault();
        setMode("ver");
        setProblem(null);
        return;
      }
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        e.preventDefault();
        if (mode === "ver") void goTo(index + (key === "j" ? 1 : -1));
        return;
      }
      if (mode !== "ver" || !open || busy || stamping) return;
      if (key === "a") {
        e.preventDefault();
        if (performance.now() >= armedAt.current) void approve();
      } else if (key === "e") {
        e.preventDefault();
        setMode("ajustar");
      } else if (key === "d") {
        e.preventDefault();
        setMode("devolver");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, busy, goTo, index, mode, open, shortcuts, stamping]);

  const marks = useMemo(
    () => (review ? evidenceMarks(review.payload.evidence, [...review.question.stimulus, ...review.question.command]) : { marks: {}, missing: [] }),
    [review],
  );

  return (
    <div ref={topRef} className="@container">
      {pending === 0 && (
        <p role="status" className="mb-6 flex flex-wrap items-center gap-4 border-y border-line-subtle py-4 t-reading">
          <span aria-hidden="true" className="stamp text-[15px] text-pen">
            Conferida
          </span>
          {AREA_LABEL[area]} está toda conferida: {rows.filter((r) => r.status === "aprovada").length} aprovadas e{" "}
          {rows.filter((r) => r.status === "devolvida").length} devolvidas. Escolha outra área acima.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="t-kicker">
            {AREA_LABEL[area]} · {index + 1} de {rows.length}
          </p>
          <h2 ref={headingRef} tabIndex={-1} className="t-section text-ink outline-none">
            Enem {row.year}, questão {row.position}
            {row.language ? ` (${LANG[row.language]})` : ""}
          </h2>
        </div>
        <label className="flex items-center gap-2 t-meta text-ink-2">
          Ir para
          <select
            className="min-h-11 rounded-control border border-line bg-surface px-2 t-meta text-ink pointer-fine:min-h-9"
            value={index}
            onChange={(e) => void goTo(Number(e.target.value))}
          >
            {rows.map((r, i) => (
              <option key={r.id} value={i}>
                {rowLabel(r)}
                {r.status === "aprovada" ? " · aprovada" : r.status === "devolvida" ? " · devolvida" : r.flagged ? " · com dúvida" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div aria-hidden="true" className="mb-7 flex h-3 items-end gap-px">
        {rows.map((r, i) => (
          <span
            key={r.id}
            className={clsx(
              "min-w-0 flex-1",
              i === index ? "h-3 bg-primary" : "h-1.5",
              i !== index && (r.status === "aprovada" ? "bg-ink" : r.status === "devolvida" ? "bg-pen" : "bg-line-subtle"),
            )}
          />
        ))}
      </div>

      {!review ? (
        <p className="py-10 t-reading text-ink-2">
          {loading ? "Buscando a ficha…" : "Não foi possível abrir esta ficha. Recarregue a página ou escolha outra questão."}
        </p>
      ) : (
        <div
          aria-busy={loading || undefined}
          className={clsx("grid gap-y-9 @[60rem]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]", loading && "opacity-60")}
        >
          <section aria-label="A questão, como o aluno vê" className="min-w-0 @[60rem]:border-r @[60rem]:border-line-subtle @[60rem]:pr-9">
            <p className="mb-3 t-kicker">A questão, como o aluno vê</p>
            {review.question.stimulus.length > 0 && (
              <div className="mb-5 flex flex-col gap-4 t-reading text-ink">
                <QuestionBlocks blocks={review.question.stimulus} marks={marks.marks} />
              </div>
            )}
            <div className="flex flex-col gap-3 t-reading font-medium text-ink">
              <QuestionBlocks blocks={review.question.command} marks={marks.marks} />
            </div>
            {review.payload.evidence.length > 0 && (
              <p className="mt-5 t-meta text-ink-2">
                <span className="rounded-[2px] bg-mark-yellow px-1 text-on-mark">Marca-texto</span> = evidência proposta: o trecho que sustenta a
                resposta.
              </p>
            )}
          </section>

          <section aria-label="Anotação proposta" className="relative min-w-0 @[60rem]:pl-9">
            {stamping && (
              <span aria-hidden="true" className="stamp stamp-hit pointer-events-none absolute right-2 top-0 z-10 bg-background text-[22px] text-pen">
                Conferida
              </span>
            )}
            {mode === "ajustar" && open ? (
              <AdjustForm
                key={review.id}
                review={review}
                options={options}
                busy={busy === "aprovar"}
                problem={problem}
                onCancel={() => {
                  setMode("ver");
                  setProblem(null);
                }}
                onProblem={setProblem}
                onApprove={(payload, note) => void approve(payload, note)}
              />
            ) : (
              <Ficha review={review} status={status} options={options} missing={marks.missing} />
            )}
          </section>
        </div>
      )}

      {/* Barra de decisão: fica à vista durante a leitura; no celular, acima das abas. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mt-9 border-t-[1.5px] border-ink bg-background pb-1 pt-3 md:bottom-0">
        {mode === "devolver" && open && (
          <form
            className="mb-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendBack();
            }}
          >
            <label htmlFor={`${uid}-nota`} className="t-ui text-ink">
              O que precisa mudar nesta anotação
            </label>
            <textarea
              id={`${uid}-nota`}
              autoFocus
              rows={2}
              maxLength={1000}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              className={clsx(field, "py-2")}
              placeholder="Ex.: a habilidade é H21, não H19; o distrator B é inversão de causa e efeito."
            />
          </form>
        )}
        {problem && mode !== "ajustar" && (
          <p role="alert" className="mb-3 t-ui text-ink">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={index === 0 || mode !== "ver"} onClick={() => void goTo(index - 1)} icon={<ChevronLeft aria-hidden="true" className="size-4" />}>
              <span className="max-sm:sr-only">Anterior</span> <Kbd>K</Kbd>
            </Button>
            <Button variant="ghost" size="sm" disabled={index >= rows.length - 1 || mode !== "ver"} onClick={() => void goTo(index + 1)} icon={<ChevronRight aria-hidden="true" className="size-4" />}>
              <span className="max-sm:sr-only">Próxima</span> <Kbd>J</Kbd>
            </Button>
            <p role="status" className="ml-2 t-meta text-ink-2">
              {pending > 0 ? `Faltam ${pending}.` : "Nada por conferir."}
              {last ? ` Última: ${last}.` : ""}
            </p>
          </div>
          {mode === "devolver" && open ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setMode("ver");
                  setProblem(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="secondary" loading={busy === "devolver"} onClick={() => void sendBack()}>
                Devolver com este motivo
              </Button>
            </div>
          ) : mode === "ajustar" && open ? (
            <p className="t-meta text-ink-2">Ajustando: os botões estão no fim da ficha. Esc cancela.</p>
          ) : open ? (
            <div className="flex gap-2 max-sm:w-full">
              <Button variant="ghost" className="max-sm:flex-1" disabled={Boolean(busy) || stamping} onClick={() => setMode("devolver")}>
                Devolver <Kbd>D</Kbd>
              </Button>
              <Button variant="secondary" className="max-sm:flex-1" disabled={Boolean(busy) || stamping} onClick={() => setMode("ajustar")}>
                Ajustar <Kbd>E</Kbd>
              </Button>
              <Button className="max-sm:flex-1" loading={busy === "aprovar"} disabled={stamping} onClick={() => void approve()}>
                Aprovar <Kbd>A</Kbd>
              </Button>
            </div>
          ) : (
            <p className="t-meta text-ink-2">
              {status === "aprovada" ? "Aprovada: já vale para o aluno." : status === "devolvida" ? "Devolvida: espera nova proposta." : ""}
            </p>
          )}
        </div>
        <label className="mt-2 hidden items-center gap-2 t-meta text-ink-2 pointer-fine:flex">
          <input type="checkbox" className="size-4 accent-[var(--rs-primary)]" checked={shortcuts} onChange={(e) => writeShortcuts(e.target.checked)} />
          Atalhos de teclado (A aprova, E ajusta, D devolve, J e K trocam de questão)
        </label>
      </div>
    </div>
  );
}

/** Tecla do atalho ao lado do rótulo; só aparece para quem usa mouse e teclado. */
function Kbd({ children }: { children: string }) {
  return (
    <kbd aria-hidden="true" className="ml-1 hidden rounded-[3px] border border-current px-1 font-mono text-[11px] leading-4 pointer-fine:inline">
      {children}
    </kbd>
  );
}

function Letter({ letter, correct }: { letter: string; correct: boolean }) {
  return (
    <span className="relative grid size-11 shrink-0 place-items-center t-ui font-semibold text-ink">
      {letter}
      {correct && (
        <svg aria-hidden="true" viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 size-full stroke-pen" fill="none" strokeWidth={1.8} strokeLinecap="round">
          <path d={ring(15, seedOf(`gabarito-${letter}`))} />
        </svg>
      )}
    </span>
  );
}

function Heading({ children }: { children: string }) {
  return <h3 className="mb-2 mt-7 border-b border-line-subtle pb-1.5 t-kicker first:mt-0">{children}</h3>;
}

/** A anotação proposta, só para ler: dúvidas de quem anotou, gabarito e erradas, resolução e classificação. */
function Ficha({ review, status, options, missing }: { review: AnnotationReview; status: QueueRow["status"]; options: ReviewOptions; missing: number[] }) {
  const p = review.payload;
  const typeLabel = (code: string | null | undefined) => options.distractorTypes.find((t) => t.code === code)?.label ?? code ?? "";
  const dep = DEPENDENCY.find((d) => d.value === p.content_dependency);
  const topWrong = review.stats
    ? Object.entries(review.stats.byKey)
        .filter(([k]) => k !== review.correctKey)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
    : undefined;
  return (
    <div className="flex flex-col">
      {status !== "proposta" && (
        <p className="mb-5 flex flex-wrap items-center gap-3 t-ui">
          <span aria-hidden="true" className="stamp text-[13px] text-pen">
            {status === "aprovada" ? "Conferida" : "Devolvida"}
          </span>
          {status === "aprovada" ? "Anotação aprovada." : "Anotação devolvida."}
          {review.reviewNote && <span className="t-meta text-ink-2">Nota: {review.reviewNote}</span>}
        </p>
      )}
      {p.uncertainties.length > 0 && (
        <div className="mb-6 rounded-card bg-mark-yellow p-3 text-on-mark">
          <p className="mb-1 font-mono text-[11.5px] font-medium uppercase leading-4 tracking-[0.1em]">Dúvida de quem anotou</p>
          <ul className="flex flex-col gap-1.5 t-ui font-normal">
            {p.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <Heading>Gabarito e alternativas</Heading>
      <ol className="flex flex-col">
        {review.question.alternatives.map((a) => {
          const correct = a.key === review.correctKey;
          const d = p.distractors.find((x) => x.key === a.key);
          const share = review.stats?.byKey[a.key];
          const second = d?.secondary && d.secondary !== "nenhum" ? typeLabel(d.secondary) : null;
          return (
            <li key={a.key} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-2 border-b border-line-subtle py-2.5 last:border-b-0">
              <Letter letter={a.letter} correct={correct} />
              <div className="min-w-0 pt-2">
                <div className="flex flex-col gap-2 t-reading text-ink">
                  <QuestionBlocks blocks={a.blocks} zoom={false} />
                </div>
                {correct ? (
                  <p className="mt-1 t-hand -rotate-1 text-pen">
                    gabarito<span className="sr-only"> oficial</span>
                  </p>
                ) : d ? (
                  <p className="mt-1.5 t-meta text-ink-2">
                    <span className="font-medium text-ink">
                      {typeLabel(d.type)}
                      {second ? ` + ${second}` : ""}.
                    </span>{" "}
                    {d.rationale}
                  </p>
                ) : (
                  <p className="mt-1.5 t-meta text-ink-2">Sem classificação proposta.</p>
                )}
              </div>
              <p className="pt-2.5 text-right t-meta tabular text-ink-2">
                {share !== undefined ? pct(share) : ""}
                {a.key === topWrong && <span className="block text-[12px] leading-4">errada mais marcada</span>}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 t-meta text-ink-2">
        {review.stats
          ? `Marcações no Enem ${review.stats.edition} (microdados do Inep): ${pct(review.stats.correctRate)} acertaram, ${pct(review.stats.blankRate)} deixaram em branco.`
          : "Marcações na prova indisponíveis para esta questão."}
      </p>

      <Heading>Resolução proposta</Heading>
      <ol className="flex list-decimal flex-col gap-2 pl-6 t-reading text-ink marker:font-sans marker:text-[14px] marker:text-ink-2">
        {p.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <Heading>Classificação</Heading>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 t-ui font-normal">
        <dt className="t-meta text-ink-2">Habilidade</dt>
        <dd>
          <span className="font-semibold">{p.skill}</span> {review.skill ? `— ${review.skill.description}` : "(fora da matriz)"}
        </dd>
        {p.skill_secondary && (
          <>
            <dt className="t-meta text-ink-2">Secundária</dt>
            <dd>
              <span className="font-semibold">{p.skill_secondary}</span> {review.skillSecondary ? `— ${review.skillSecondary.description}` : ""}
            </dd>
          </>
        )}
        <dt className="t-meta text-ink-2">Assunto</dt>
        <dd>
          {review.subject ? (
            <>
              {review.subject.path.slice(0, -1).map((x) => (
                <span key={x} className="t-meta text-ink-2">
                  {x} ›{" "}
                </span>
              ))}
              <span className="font-semibold">{review.subject.path.at(-1)}</span>{" "}
              <span className="t-meta tabular text-ink-2">({review.subject.code})</span>
            </>
          ) : (
            `${p.subject_code} (fora da árvore)`
          )}
        </dd>
        <dt className="t-meta text-ink-2">Conteúdo</dt>
        <dd>
          <span className="font-semibold">{dep?.label ?? p.content_dependency}</span>
          {dep && <span className="t-meta text-ink-2"> {dep.hint}</span>}
        </dd>
      </dl>

      <Heading>Evidência</Heading>
      {p.evidence.length === 0 ? (
        <p className="t-ui font-normal text-ink-2">Nenhum trecho proposto (a resposta não sai de um trecho do texto).</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {p.evidence.map((e, i) => (
            <li key={i} className="t-ui font-normal">
              <mark className="rounded-[2px] bg-mark-yellow px-0.5 text-on-mark [box-decoration-break:clone]">“{e.quote}”</mark>
              {e.rationale && <span className="mt-0.5 block t-meta text-ink-2">{e.rationale}</span>}
              {missing.includes(i) && <span className="mt-0.5 block t-meta text-ink">Trecho não localizado no texto exibido: confira antes de aprovar.</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ajuste do editor: os mesmos campos da proposta, editáveis. Aprovar com ajustes grava a versão corrigida. */
function AdjustForm({
  review,
  options,
  busy,
  problem,
  onCancel,
  onProblem,
  onApprove,
}: {
  review: AnnotationReview;
  options: ReviewOptions;
  busy: boolean;
  problem: string | null;
  onCancel: () => void;
  onProblem: (p: string | null) => void;
  onApprove: (payload: AnnotationPayload, note: string) => void;
}) {
  const uid = useId();
  const wrong = review.question.alternatives.filter((a) => a.key !== review.correctKey);
  const [draft, setDraft] = useState<AnnotationPayload>(() => ({
    ...review.payload,
    distractors: wrong.map(
      (a) => review.payload.distractors.find((d) => d.key === a.key) ?? { key: a.key, type: "nao_classificado", secondary: "nenhum", rationale: "" },
    ),
  }));
  const [stepsText, setStepsText] = useState(() => review.payload.steps.join("\n"));
  const [note, setNote] = useState("");
  const firstRef = useRef<HTMLSelectElement>(null);
  useEffect(() => firstRef.current?.focus({ preventScroll: true }), []);

  const groups = useMemo(() => {
    const out: { group: string; items: ReviewOptions["subjects"] }[] = [];
    for (const s of options.subjects) {
      const g = out.at(-1);
      if (g && g.group === s.group) g.items.push(s);
      else out.push({ group: s.group, items: [s] });
    }
    return out;
  }, [options.subjects]);

  const setDistractor = (key: string, patch: Partial<AnnotationPayload["distractors"][number]>) =>
    setDraft((d) => ({ ...d, distractors: d.distractors.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));

  const addSelection = () => {
    const quote = window.getSelection()?.toString().trim() ?? "";
    const blocks = [...review.question.stimulus, ...review.question.command].filter((b) => b.text && b.text.includes(quote));
    if (quote.length < 3 || blocks.length !== 1) {
      return onProblem("Selecione com o mouse um trecho de um único parágrafo do texto ou do comando, e então use este botão.");
    }
    if (draft.evidence.length >= 8) return onProblem("No máximo 8 trechos de evidência.");
    const b = blocks[0]!;
    const start = b.text!.indexOf(quote);
    onProblem(null);
    setDraft((d) => ({ ...d, evidence: [...d.evidence, { block_id: b.id, start_utf16: start, end_utf16: start + quote.length, quote, rationale: "" }] }));
  };

  const submit = () => {
    const subject = options.subjects.find((s) => s.id === draft.subject);
    const payload: AnnotationPayload = {
      ...draft,
      subject_code: subject?.code ?? draft.subject_code,
      steps: stepsFromText(stepsText),
      distractors: draft.distractors.map((d) => ({ ...d, rationale: d.rationale.trim() })),
    };
    const problems = adjustProblems(payload, wrong.map((a) => a.key));
    if (problems.length) return onProblem(problems.join(" "));
    onProblem(null);
    onApprove(payload, note.trim());
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="t-kicker">Ajustar a anotação</p>
      <div className="grid gap-4 @[34rem]:grid-cols-2">
        <label className="flex flex-col gap-1.5 t-ui text-ink">
          Habilidade
          <select ref={firstRef} className={field} value={draft.skill} onChange={(e) => setDraft((d) => ({ ...d, skill: e.target.value }))}>
            {options.skills.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.description.length > 90 ? `${s.description.slice(0, 89)}…` : s.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 t-ui text-ink">
          Habilidade secundária
          <select className={field} value={draft.skill_secondary ?? ""} onChange={(e) => setDraft((d) => ({ ...d, skill_secondary: e.target.value || null }))}>
            <option value="">Nenhuma</option>
            {options.skills.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.description.length > 90 ? `${s.description.slice(0, 89)}…` : s.description}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 t-ui text-ink">
        Assunto
        <select className={field} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}>
          {groups.map((g) => (
            <optgroup key={g.group + g.items[0]!.code} label={g.group}>
              {g.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 t-ui text-ink">Quanto depende de conteúdo</legend>
        {DEPENDENCY.map((d) => (
          <label key={d.value} className="flex min-h-11 items-center gap-3 t-ui font-normal text-ink pointer-fine:min-h-8">
            <input
              type="radio"
              name={`${uid}-dep`}
              className="size-4 accent-[var(--rs-primary)]"
              checked={draft.content_dependency === d.value}
              onChange={() => setDraft((x) => ({ ...x, content_dependency: d.value }))}
            />
            <span>
              {d.label} <span className="t-meta text-ink-2">{d.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 t-ui text-ink">Por que cada errada atrai (gabarito: {review.question.alternatives.find((a) => a.key === review.correctKey)?.letter ?? "indisponível"})</legend>
        {wrong.map((a) => {
          const d = draft.distractors.find((x) => x.key === a.key)!;
          return (
            <div key={a.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-2">
              <span className="pt-2.5 t-ui font-semibold text-ink">{a.letter}</span>
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 @[34rem]:grid-cols-2">
                  <select aria-label={`Tipo do distrator ${a.letter}`} className={field} value={d.type} onChange={(e) => setDistractor(a.key, { type: e.target.value })}>
                    {options.distractorTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Segundo tipo do distrator ${a.letter}`}
                    className={field}
                    value={d.secondary && d.secondary !== "nenhum" ? d.secondary : ""}
                    onChange={(e) => setDistractor(a.key, { secondary: e.target.value || "nenhum" })}
                  >
                    <option value="">Sem segundo tipo</option>
                    {options.distractorTypes
                      .filter((t) => t.code !== "nao_classificado")
                      .map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                  </select>
                </div>
                <textarea
                  aria-label={`Justificativa do distrator ${a.letter}`}
                  rows={2}
                  maxLength={600}
                  className={clsx(field, "py-2")}
                  value={d.rationale}
                  onChange={(e) => setDistractor(a.key, { rationale: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </fieldset>

      <label className="flex flex-col gap-1.5 t-ui text-ink">
        Resolução (um passo por linha)
        <textarea rows={Math.max(4, stepsText.split("\n").length + 1)} className={clsx(field, "py-2")} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 t-ui text-ink">Evidência</legend>
        {draft.evidence.length === 0 && <p className="t-meta text-ink-2">Nenhum trecho marcado.</p>}
        {draft.evidence.map((e, i) => (
          <div key={`${e.block_id}-${e.start_utf16}-${i}`} className="flex flex-col gap-1.5">
            <p className="t-ui font-normal">
              <mark className="rounded-[2px] bg-mark-yellow px-0.5 text-on-mark [box-decoration-break:clone]">“{e.quote}”</mark>
            </p>
            <div className="flex gap-2">
              <input
                aria-label={`Por que o trecho ${i + 1} sustenta a resposta`}
                className={field}
                maxLength={600}
                value={e.rationale}
                onChange={(ev) => setDraft((d) => ({ ...d, evidence: d.evidence.map((x, j) => (j === i ? { ...x, rationale: ev.target.value } : x)) }))}
              />
              <Button type="button" variant="ghost" onClick={() => setDraft((d) => ({ ...d, evidence: d.evidence.filter((_, j) => j !== i) }))}>
                Remover
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addSelection}>
            Usar o trecho selecionado na questão
          </Button>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 t-ui text-ink">
        Nota do editor (opcional)
        <input className={field} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {problem && (
        <p role="alert" className="t-ui text-ink">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          Aprovar com ajustes
        </Button>
      </div>
    </form>
  );
}
