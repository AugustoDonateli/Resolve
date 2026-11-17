"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { QuestionBlocks } from "@/components/question/question-view";
import { Button } from "@/components/ui/button";
import { startLessonPractice, rateLessonSection } from "@/lib/lessons/actions";
import { isRight } from "@/lib/lessons/answer";
import type { LessonPage, Section, Verdict } from "@/lib/lessons/data";
import type { Gap, Lesson, Letter } from "@/lib/lessons/types";
import { ring, seedOf } from "@/lib/ink/paths";
import { AREA_LABEL, type StudyQuestion } from "@/lib/study/question-types";

const pct = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const qLabel = (code: string) => {
  const [y, p] = code.split("-");
  return `questão ${p} do Enem ${y}`;
};

const PARTS: { id: Section; title: string }[] = [
  { id: "entrada", title: "Pergunta de entrada" },
  { id: "explicacao", title: "O essencial" },
  { id: "exemplo", title: "Exemplo resolvido" },
  { id: "lacunas", title: "Agora você completa" },
  { id: "treino", title: "Sozinho" },
  { id: "pegadinhas", title: "Pegadinhas" },
  { id: "cartoes", title: "Resumo em cartões" },
];
const VERDICT_LABEL: Record<Verdict, string> = {
  entendi: "entendi",
  confuso: "confuso",
  chato: "chato",
};

/** Índice da lição, ao lado do texto em telas largas: as partes, com a marcação já feita em cada uma. */
function LessonIndex({ marks }: { marks: Partial<Record<Section, Verdict>> }) {
  const done = PARTS.filter((p) => marks[p.id]).length;
  return (
    <nav
      aria-label="Partes da lição"
      className="sticky top-8 hidden self-start lg:block"
    >
      <p className="t-kicker">Nesta lição</p>
      <ol className="mt-3 flex flex-col border-l border-line">
        {PARTS.map((p, i) => (
          <li key={p.id}>
            <a
              href={`#${p.id}`}
              className="-ml-px flex min-h-9 items-baseline gap-2 border-l-2 border-transparent py-1.5 pl-3 t-ui text-ink-2 hover:border-ink hover:text-ink"
            >
              <span className="font-mono text-[11.5px]">{i + 1}</span>
              <span className="flex-1">{p.title}</span>
              {marks[p.id] && (
                <span className="t-meta text-ink-2">
                  {VERDICT_LABEL[marks[p.id]!]}
                </span>
              )}
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-[16rem] t-meta text-ink-2">
        {done === PARTS.length
          ? "Todas as partes marcadas. Obrigado pelo retorno."
          : `${done} de ${PARTS.length} partes marcadas. Sua marcação decide o que muda antes das próximas lições.`}
      </p>
    </nav>
  );
}

/** Marcação de uma parte: entendi, confuso aqui (com nota) ou chato. Fica guardada na conta. */
function Rate({
  slug,
  section,
  initial,
  onSaved,
}: {
  slug: string;
  section: Section;
  initial?: { verdict: Verdict; note: string | null };
  onSaved: (section: Section, verdict: Verdict) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(
    initial?.verdict ?? null,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const uid = useId();
  const save = (v: Verdict, n?: string) =>
    start(async () => {
      setVerdict(v);
      const r = await rateLessonSection({ slug, section, verdict: v, note: n });
      setSaved(
        r.ok
          ? "Marcação guardada."
          : (r.message ?? "Não foi possível guardar."),
      );
      if (r.ok) onSaved(section, v);
    });
  return (
    <div className="mt-6 border-t border-dashed border-line pt-3">
      <div
        role="group"
        aria-label="O que você achou desta parte"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="t-meta text-ink-2">Esta parte:</span>
        {(
          [
            ["entendi", "Entendi"],
            ["confuso", "Confuso aqui"],
            ["chato", "Chato"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={verdict === v}
            disabled={pending}
            onClick={() => save(v, v === "entendi" ? undefined : note)}
            className="min-h-11 rounded-control border border-line px-3 t-meta text-ink hover:bg-surface-subtle aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background pointer-fine:min-h-9"
          >
            {label}
          </button>
        ))}
      </div>
      {(verdict === "confuso" || verdict === "chato") && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(verdict, note);
          }}
        >
          <label
            htmlFor={`${uid}-nota`}
            className="flex min-w-[16rem] flex-1 flex-col gap-1 t-meta text-ink-2"
          >
            {verdict === "confuso"
              ? "Qual trecho ficou confuso?"
              : "O que deixou chato?"}{" "}
            (opcional)
            <input
              id={`${uid}-nota`}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui font-normal text-ink"
            />
          </label>
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            Guardar
          </Button>
        </form>
      )}
      <p aria-live="polite" className="mt-1 min-h-5 t-meta text-ink-2">
        {saved}
      </p>
    </div>
  );
}

function Part({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-t`}
      className="scroll-mt-20 border-t-[1.5px] border-ink pt-6"
    >
      <p className="t-kicker">Parte {n}</p>
      <h2 id={`${id}-t`} className="t-section text-ink">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Mark({ letter, correct }: { letter: string; correct: boolean }) {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center t-ui font-semibold text-ink">
      {letter}
      {correct && (
        <svg
          aria-hidden="true"
          viewBox="0 0 44 44"
          className="pointer-events-none absolute inset-0 size-full stroke-pen"
          fill="none"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <path d={ring(15, seedOf(`licao-${letter}`))} />
        </svg>
      )}
    </span>
  );
}

/** Uma questão real dentro da lição: texto, comando e alternativas; com `correct`, o gabarito aparece circulado. */
function RealQuestion({
  code,
  q,
  correct,
}: {
  code: string;
  q: StudyQuestion | undefined;
  correct: Letter | null;
}) {
  if (!q)
    return (
      <p className="t-meta text-ink-2">
        A {qLabel(code)} não está disponível agora.
      </p>
    );
  return (
    <article
      aria-label={`Enunciado da ${qLabel(code)}`}
      className="rounded-card border border-line-subtle bg-surface p-4 shadow-paper sm:p-6"
    >
      <p className="mb-3 t-kicker">
        {AREA_LABEL[q.area]} · {q.origin}
      </p>
      {q.stimulus.length > 0 && (
        <div
          className="mb-4 flex max-h-[30rem] flex-col gap-3 overflow-y-auto pr-1 t-reading text-ink"
          tabIndex={0}
          aria-label="Texto da questão"
        >
          <QuestionBlocks blocks={q.stimulus} />
        </div>
      )}
      <div className="mb-3 flex flex-col gap-2 t-reading font-medium text-ink">
        <QuestionBlocks blocks={q.command} />
      </div>
      <ol className="flex flex-col">
        {q.alternatives.map((a) => (
          <li
            key={a.key}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-2 border-t border-line-subtle py-1.5"
          >
            <Mark letter={a.letter} correct={correct === a.letter} />
            <div className="flex flex-col gap-1 pt-2 t-reading text-ink">
              <QuestionBlocks blocks={a.blocks} zoom={false} />
              {correct === a.letter && (
                <span className="sr-only">(gabarito)</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function GapStep({
  gap,
  n,
  onDone,
}: {
  gap: Gap;
  n: number;
  onDone: (firstTry: boolean) => void;
}) {
  const uid = useId();
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<"aberta" | "certa" | "revelada">("aberta");
  const [wrong, setWrong] = useState<string | null>(null);
  const finish = (s: "certa" | "revelada") => {
    setState(s);
    onDone(s === "certa" && tries === 0);
  };
  const check = (ok: boolean) => {
    if (ok) return finish("certa");
    setTries((t) => t + 1);
    setWrong(
      gap.kind === "numero"
        ? `Ainda não. Dica: ${gap.hint}`
        : "Ainda não. Releia o comando e tente outra.",
    );
  };
  return (
    <li className="flex flex-col gap-2 border-t border-line-subtle py-4">
      <p className="t-ui text-ink">
        <span className="mr-2 font-mono text-[12px] text-ink-2">{n}</span>
        {gap.label}
      </p>
      {state === "aberta" ? (
        gap.kind === "numero" ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              check(isRight(value, gap.answer, gap.tolerance));
            }}
          >
            <label htmlFor={`${uid}-v`} className="sr-only">
              Sua resposta
            </label>
            <input
              id={`${uid}-v`}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-line max-w-[12rem] tabular"
              aria-describedby={`${uid}-msg`}
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!value.trim()}
            >
              Conferir
            </Button>
            {tries >= 2 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => finish("revelada")}
              >
                Ver a resposta
              </Button>
            )}
          </form>
        ) : (
          <div
            role="group"
            aria-label={gap.label}
            className="flex flex-col gap-2"
          >
            {gap.choices.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => check(i === gap.correctIndex)}
                className="min-h-11 rounded-control border border-line bg-surface px-3 py-2 text-left t-ui font-normal text-ink hover:border-ink"
              >
                {c}
              </button>
            ))}
            {tries >= 2 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => finish("revelada")}
              >
                Ver a resposta
              </Button>
            )}
          </div>
        )
      ) : (
        <p className="t-reading text-ink">
          <span
            className={clsx(
              "mr-2 t-hand",
              state === "certa" ? "text-primary" : "text-pen",
            )}
          >
            {state === "certa" ? "certo" : "resposta"}
          </span>
          {gap.explain}
        </p>
      )}
      <p id={`${uid}-msg`} aria-live="polite" className="t-meta text-ink-2">
        {state === "aberta" ? wrong : null}
      </p>
    </li>
  );
}

/** A lição inteira, em partes, na ordem do plano v2 (2A.2). */
export function LessonView({
  lesson,
  page,
}: {
  lesson: Lesson;
  page: LessonPage;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState<number | null>(null);
  const [gapsDone, setGapsDone] = useState<boolean[]>([]);
  const [pending, start] = useTransition();
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const entryRight =
    entry !== null && lesson.entry.options[entry]?.correct === true;
  const allGaps =
    gapsDone.filter((x) => x !== undefined).length ===
    lesson.gapped.gaps.length;
  const firstTry = allGaps && gapsDone.every(Boolean);
  const fb = page.feedback;
  const [marks, setMarks] = useState<Partial<Record<Section, Verdict>>>(() =>
    Object.fromEntries(Object.entries(fb).map(([k, v]) => [k, v!.verdict])),
  );
  const onSaved = (section: Section, verdict: Verdict) =>
    setMarks((m) => ({ ...m, [section]: verdict }));

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,72ch)_15rem] lg:gap-16">
      <div className="flex min-w-0 max-w-[72ch] flex-col gap-10">
        <p className="t-reading text-ink">{lesson.oneLine}</p>

        <Part n={1} id="entrada" title="Pergunta de entrada">
          <p className="mb-1 t-meta text-ink-2">
            Não vale nota e não é do Enem. Serve para você ver o que já sabe.
          </p>
          <p className="mb-3 t-reading text-ink">{lesson.entry.prompt}</p>
          <div
            role="group"
            aria-label="Opções"
            className="flex flex-wrap gap-2"
          >
            {lesson.entry.options.map((o, i) => (
              <button
                key={o.text}
                type="button"
                aria-pressed={entry === i}
                disabled={entry !== null}
                onClick={() => setEntry(i)}
                className={clsx(
                  "min-h-11 rounded-control border px-4 t-ui",
                  entry === i
                    ? "border-ink bg-ink text-background"
                    : "border-line bg-surface text-ink hover:border-ink",
                  entry !== null && entry !== i && "opacity-60",
                )}
              >
                {o.text}
              </button>
            ))}
          </div>
          <div aria-live="polite">
            {entry !== null && (
              <p className="mt-3 t-reading text-ink">
                {lesson.entry.options[entry]!.feedback}
                {entryRight && (
                  <>
                    {" "}
                    <a href="#treino" className="text-link underline">
                      Se quiser, pule direto para as questões
                    </a>
                    .
                  </>
                )}
              </p>
            )}
          </div>
          <Rate
            slug={lesson.slug}
            section="entrada"
            initial={fb.entrada}
            onSaved={onSaved}
          />
        </Part>

        <Part n={2} id="explicacao" title="O essencial">
          <div className="flex flex-col gap-4 t-reading text-ink">
            {lesson.explanation.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {entry !== null && !entryRight && (
              <p className="border-l-2 border-primary pl-4">
                {lesson.extraExample}
              </p>
            )}
          </div>
          <Rate
            slug={lesson.slug}
            section="explicacao"
            initial={fb.explicacao}
            onSaved={onSaved}
          />
        </Part>

        <Part n={3} id="exemplo" title="Exemplo resolvido">
          <p className="mb-4 t-reading text-ink">{lesson.worked.intro}</p>
          <RealQuestion
            code={lesson.worked.q}
            q={page.questions[lesson.worked.q]}
            correct={lesson.worked.correct}
          />
          <ol className="mt-5 flex list-decimal flex-col gap-3 pl-6 t-reading text-ink marker:font-sans marker:text-[14px] marker:text-ink-2">
            {lesson.worked.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-4 rounded-card bg-surface-subtle p-3 t-ui font-normal text-ink">
            {lesson.worked.afterNote}
          </p>
          <Rate
            slug={lesson.slug}
            section="exemplo"
            initial={fb.exemplo}
            onSaved={onSaved}
          />
        </Part>

        <Part n={4} id="lacunas" title="Agora você completa">
          <p className="mb-4 t-reading text-ink">{lesson.gapped.intro}</p>
          <RealQuestion
            code={lesson.gapped.q}
            q={page.questions[lesson.gapped.q]}
            correct={allGaps ? lesson.gapped.correct : null}
          />
          <ol className="mt-4 flex flex-col">
            {lesson.gapped.gaps.map((g, i) =>
              i === 0 || gapsDone[i - 1] !== undefined ? (
                <GapStep
                  key={g.label}
                  gap={g}
                  n={i + 1}
                  onDone={(ok) =>
                    setGapsDone((d) => {
                      const n = [...d];
                      n[i] = ok;
                      return n;
                    })
                  }
                />
              ) : null,
            )}
          </ol>
          {allGaps && (
            <p role="status" className="mt-2 t-reading text-ink">
              {lesson.gapped.conclusion}
              {firstTry &&
                " Você completou tudo de primeira: pode ir direto para as questões sozinho."}
            </p>
          )}
          <Rate
            slug={lesson.slug}
            section="lacunas"
            initial={fb.lacunas}
            onSaved={onSaved}
          />
        </Part>

        <Part n={5} id="treino" title="Sozinho">
          <p className="t-reading text-ink">{lesson.practice.note}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  setPracticeError(null);
                  const r = await startLessonPractice({
                    slug: lesson.slug,
                    actionId: crypto.randomUUID(),
                  });
                  if (r.ok) router.push(`/estudar/sessao/${r.sessionId}`);
                  else setPracticeError(r.message);
                })
              }
            >
              Resolver {lesson.practice.qs.length} questões
            </Button>
            {page.bankHref && (
              <Link
                href={page.bankHref}
                className="inline-flex min-h-11 items-center t-ui text-link underline"
              >
                Mais questões deste assunto no banco
              </Link>
            )}
          </div>
          <p aria-live="polite" className="mt-2 t-ui text-ink">
            {practiceError}
          </p>
          <Rate
            slug={lesson.slug}
            section="treino"
            initial={fb.treino}
            onSaved={onSaved}
          />
        </Part>

        <Part n={6} id="pegadinhas" title="Pegadinhas">
          <ul className="flex flex-col gap-6">
            {lesson.traps.map((t) => (
              <li key={`${t.q}-${t.key}`}>
                <h3 className="t-ui font-semibold text-ink">{t.title}</h3>
                <div className="mt-1 flex flex-col gap-2 t-reading text-ink">
                  {t.text.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
                <p className="mt-1 t-meta text-ink-2">
                  Na {qLabel(t.q)}, {pct(t.share)}% de quem fez a prova marcou a
                  alternativa {t.key}. Microdados do Inep, Enem {t.edition}.
                </p>
              </li>
            ))}
          </ul>
          <Rate
            slug={lesson.slug}
            section="pegadinhas"
            initial={fb.pegadinhas}
            onSaved={onSaved}
          />
        </Part>

        <Part n={7} id="cartoes" title="Resumo em cartões">
          <p className="mb-3 t-meta text-ink-2">
            Toque num cartão para ver o verso. Eles vão para a sua revisão
            quando a lição sair do piloto.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lesson.cards.map((c, i) => {
              const open = flipped.has(i);
              return (
                <li key={c.front}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setFlipped((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className="ruled flex min-h-32 w-full flex-col justify-between gap-3 rounded-card border border-line-subtle bg-surface p-4 text-left shadow-paper [--pauta:28px]"
                  >
                    <span className="t-ui text-ink">{c.front}</span>
                    {open ? (
                      <span className="t-reading text-ink">{c.back}</span>
                    ) : (
                      <span className="t-meta text-ink-2">Ver o verso</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Rate
            slug={lesson.slug}
            section="cartoes"
            initial={fb.cartoes}
            onSaved={onSaved}
          />
        </Part>
      </div>
      <LessonIndex marks={marks} />
    </div>
  );
}
