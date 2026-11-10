"use client";

import { clsx } from "clsx";
import { ArrowRight, Check, Eye, Highlighter, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { QuestionBlocks } from "@/components/question/question-view";
import { Alternatives } from "@/components/ui/alternatives";
import { Button } from "@/components/ui/button";
import { AREA_LABEL, type QuestionBlock, type StudyQuestion } from "@/lib/study/question-types";
import { addRange, compareDistractors, compareEvidence, EVIDENCE_RULE, type DistractorChoice, type Range } from "@/lib/study/skills";

export interface SkillEntry {
  id: string;
  question: StudyQuestion;
}

export interface SkillResult {
  correctKey: string;
  annotationStatus: "aprovadas" | "pendentes";
  evidence: (Range & { rationale: string | null })[] | null;
  distractors: { key: string; type: string; label: string; rationale: string }[] | null;
}

/** Onde o treino grava e de onde vem o retorno (sessão real ou demonstração). */
export interface SkillBackend {
  recordEvidence(entry: SkillEntry, ranges: Range[], none: "figura" | "calculo" | "nao_encontrei" | null): Promise<string | null>;
  submit(entry: SkillEntry, key: string): Promise<{ ok: true; correctKey: string } | { ok: false; message: string }>;
  recordChoices(entry: SkillEntry, choices: DistractorChoice[]): Promise<string | null>;
  result(entry: SkillEntry): Promise<SkillResult | null>;
}

export interface Taxon {
  code: string;
  label: string;
  definition: string;
}

type Phase = "comando" | "evidencia" | "resposta" | "classificacao" | "retorno";

/** Texto de um bloco com marcações: as do aluno em amarelo; as editoriais sublinhadas em azul. */
function MarkedText({ text, mine, editorial }: { text: string; mine: Range[]; editorial: Range[] }) {
  const cuts = new Set([0, text.length]);
  for (const r of [...mine, ...editorial]) {
    cuts.add(Math.max(0, Math.min(text.length, r.start_utf16)));
    cuts.add(Math.max(0, Math.min(text.length, r.end_utf16)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!];
    const inMine = mine.some((r) => r.start_utf16 <= a && b <= r.end_utf16);
    const inEd = editorial.some((r) => r.start_utf16 <= a && b <= r.end_utf16);
    const s = text.slice(a, b);
    parts.push(
      inMine || inEd ? (
        <mark
          key={a}
          className={clsx(
            "rounded-[2px] text-on-mark",
            inMine ? "bg-mark-yellow" : "bg-transparent text-ink",
            inEd && "underline decoration-link decoration-2 underline-offset-4",
          )}
        >
          {s}
        </mark>
      ) : (
        <span key={a}>{s}</span>
      ),
    );
  }
  return <>{parts}</>;
}

function StimulusText({
  blocks,
  mine,
  editorial,
  selectable,
  onSelect,
}: {
  blocks: QuestionBlock[];
  mine: Range[];
  editorial: Range[];
  selectable: boolean;
  onSelect?: (r: Range) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const capture = () => {
    if (!selectable || !onSelect || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const owner = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest<HTMLElement>("[data-block-id]");
    const a = owner(r.startContainer);
    if (!a || a !== owner(r.endContainer) || !ref.current.contains(a)) return;
    const pre = document.createRange();
    pre.selectNodeContents(a);
    pre.setEnd(r.startContainer, r.startOffset);
    const raw = r.toString();
    const lead = raw.length - raw.trimStart().length;
    const start = pre.toString().length + lead;
    const quote = raw.trim();
    if (quote.length < 3) return;
    onSelect({ block_id: a.dataset.blockId!, start_utf16: start, end_utf16: start + quote.length, quote });
    sel.removeAllRanges();
  };
  return (
    <div
      ref={ref}
      onMouseUp={capture}
      onTouchEnd={() => window.setTimeout(capture, 0)}
      className={clsx("flex flex-col gap-4 t-reading text-ink", selectable && "cursor-text selection:bg-mark-yellow/70")}
    >
      {blocks.map((b) =>
        b.type === "paragraph" && b.text ? (
          <p key={b.id} data-block-id={b.id}>
            <MarkedText text={b.text} mine={mine.filter((r) => r.block_id === b.id)} editorial={editorial.filter((r) => r.block_id === b.id)} />
          </p>
        ) : (
          <QuestionBlocks key={b.id} blocks={[b]} />
        ),
      )}
    </div>
  );
}

const NONE_LABEL = { figura: "Está numa figura", calculo: "Depende de cálculo", nao_encontrei: "Não encontrei" } as const;

export function SkillRunner({
  skill,
  entries,
  backend,
  taxonomy,
  badge,
}: {
  skill: "comando" | "distrator";
  entries: SkillEntry[];
  backend: SkillBackend;
  taxonomy: Taxon[];
  badge?: ReactNode;
}) {
  const reduced = useReduced();
  const [index, setIndex] = useState(0);
  const entry = entries[index]!;
  const [phase, setPhase] = useState<Phase>(skill === "comando" ? "comando" : "resposta");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [none, setNone] = useState<keyof typeof NONE_LABEL | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  const [correctKey, setCorrectKey] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SkillResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ answered: 0, correct: 0, evidenceMatched: 0, evidenceCompared: 0, agree: 0, compared: 0 });

  const q = entry.question;
  const T = { duration: reduced ? 0 : duration.layout / 1000, ease: ease.layout };
  const letterOf = useCallback((key: string) => q.alternatives.find((a) => a.key === key)?.letter ?? key, [q]);
  const wrong = useMemo(() => q.alternatives.filter((a) => a.key !== correctKey), [q, correctKey]);

  const reset = () => {
    setPhase(skill === "comando" ? "comando" : "resposta");
    setRanges([]);
    setNone(null);
    setValue(null);
    setEliminated(new Set());
    setCorrectKey(null);
    setChoices({});
    setNotes({});
    setResult(null);
    setError(null);
  };

  const toAnswers = async () => {
    setBusy(true);
    const e = await backend.recordEvidence(entry, ranges, ranges.length ? null : none);
    setBusy(false);
    if (e) return setError(e);
    setError(null);
    setPhase("resposta");
  };

  const confirm = async () => {
    if (!value) return;
    setBusy(true);
    const r = await backend.submit(entry, value);
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    setCorrectKey(r.correctKey);
    const correct = r.correctKey === value;
    if (skill === "comando") {
      const res = await backend.result(entry);
      setResult(res);
      const cmp = res?.evidence ? compareEvidence(ranges, res.evidence) : null;
      setTally((t) => ({
        ...t,
        answered: t.answered + 1,
        correct: t.correct + (correct ? 1 : 0),
        evidenceCompared: t.evidenceCompared + (cmp ? 1 : 0),
        evidenceMatched: t.evidenceMatched + (cmp?.matched ? 1 : 0),
      }));
      setPhase("retorno");
    } else {
      setTally((t) => ({ ...t, answered: t.answered + 1, correct: t.correct + (correct ? 1 : 0) }));
      setPhase("classificacao");
    }
    setBusy(false);
    setError(null);
  };

  const compare = async () => {
    const list: DistractorChoice[] = wrong.map((a) => ({ key: a.key, type: choices[a.key] ?? "nao_sei", justification: notes[a.key]?.trim() || undefined }));
    setBusy(true);
    const e = await backend.recordChoices(entry, list);
    if (e) {
      setBusy(false);
      return setError(e);
    }
    const res = await backend.result(entry);
    setResult(res);
    const rows = compareDistractors(list, res?.distractors ?? null);
    setTally((t) => ({
      ...t,
      compared: t.compared + rows.filter((r) => r.agrees !== null).length,
      agree: t.agree + rows.filter((r) => r.agrees).length,
    }));
    setBusy(false);
    setError(null);
    setPhase("retorno");
  };

  const next = () => {
    if (index + 1 < entries.length) {
      setIndex(index + 1);
      reset();
    } else setIndex(entries.length);
  };

  if (index >= entries.length) {
    return (
      <section aria-labelledby="fim" className="flex max-w-2xl flex-col gap-4">
        <h2 id="fim" className="font-display text-[32px] leading-tight">
          Treino concluído
        </h2>
        <p className="t-reading text-ink">
          {tally.correct} de {tally.answered} {tally.answered === 1 ? "acerto" : "acertos"}.
          {skill === "comando" &&
            (tally.evidenceCompared
              ? ` Evidência correspondente em ${tally.evidenceMatched} de ${tally.evidenceCompared} questões com etiqueta revisada (regra ${EVIDENCE_RULE}).`
              : " A correspondência da evidência não pôde ser medida: nenhuma questão tinha evidência revisada.")}
          {skill === "distrator" &&
            (tally.compared
              ? ` Sua classificação concordou com a etiqueta revisada em ${tally.agree} de ${tally.compared} alternativas.`
              : " A classificação não pôde ser comparada: nenhuma questão tinha distratores revisados.")}
        </p>
        <p className="t-meta text-ink-2">Acerto e leitura são medidas separadas: uma não substitui a outra.</p>
      </section>
    );
  }

  const step = (n: number, label: string, active: boolean, done: boolean) => (
    <li className={clsx("flex items-center gap-2 t-meta", active ? "text-ink" : done ? "text-ink-2" : "text-ink-2/70")}>
      <span
        className={clsx(
          "grid size-6 place-items-center rounded-full border text-[12px]",
          done ? "border-ink bg-ink text-background" : active ? "border-primary text-link" : "border-line-subtle",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </span>
      {label}
    </li>
  );
  const order: Phase[] = skill === "comando" ? ["comando", "evidencia", "resposta", "retorno"] : ["resposta", "classificacao", "retorno"];
  const at = order.indexOf(phase);
  const evidenceCmp = result?.evidence ? compareEvidence(ranges, result.evidence) : null;
  const rows = skill === "distrator" && phase === "retorno" ? compareDistractors(wrong.map((a) => ({ key: a.key, type: choices[a.key] ?? "nao_sei" })), result?.distractors ?? null) : [];
  const typeLabel = (code: string) => (code === "nao_sei" ? "Não sei" : (taxonomy.find((t) => t.code === code)?.label ?? code));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Etapas">
          {(skill === "comando"
            ? [["Ler o comando"], ["Marcar a evidência"], ["Responder"], ["Comparar"]]
            : [["Responder"], ["Classificar os erros"], ["Comparar"]]
          ).map(([l], i) => (
            <span key={l}>{step(i + 1, l!, i === at, i < at)}</span>
          ))}
        </ol>
        <span className="t-meta tabular text-ink-2">
          Questão {index + 1} de {entries.length}
        </span>
      </div>

      <article className="max-w-[72ch] rounded-panel border border-line-subtle bg-surface p-4 sm:p-7" aria-label={`Questão ${index + 1}`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="t-meta font-medium uppercase tracking-[0.08em] text-ink-2">{AREA_LABEL[q.area]}</span>
          <span className="t-meta text-ink-2">· {q.origin}</span>
          {badge}
        </div>

        {/* Texto-base: reservado no comando primeiro até a ação de liberar */}
        {q.stimulus.length > 0 && (
          <div className="mb-5">
            <AnimatePresence initial={false} mode="wait">
              {skill === "comando" && phase === "comando" ? (
                <motion.div
                  key="reservado"
                  exit={{ opacity: 0, scaleY: 0.96 }}
                  transition={T}
                  className="relative overflow-hidden rounded-card border border-dashed border-line px-5 py-6"
                  style={{ transformOrigin: "50% 0%" }}
                >
                  <div aria-hidden className="flex flex-col gap-3">
                    {[92, 100, 84, 96, 60].map((w, i) => (
                      <span key={i} className="block h-2 rounded-full bg-surface-subtle" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <p className="mt-4 t-meta text-ink-2">Texto reservado. Leia o comando primeiro e decida o que procurar.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="texto"
                  initial={skill === "comando" ? { opacity: 0, y: reduced ? 0 : -6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={T}
                >
                  <StimulusText
                    blocks={q.stimulus}
                    mine={skill === "comando" ? ranges : []}
                    editorial={skill === "comando" && phase === "retorno" && result?.evidence ? result.evidence : []}
                    selectable={skill === "comando" && phase === "evidencia"}
                    onSelect={(r) => {
                      setRanges((rs) => addRange(rs, r));
                      setNone(null);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div
          id={`cmd-${entry.id}`}
          className={clsx(
            "mb-4 flex flex-col gap-3 t-reading font-medium text-ink",
            skill === "comando" && phase === "comando" && "rounded-card border-l-4 border-mark-yellow bg-surface-subtle px-4 py-3 text-ink",
          )}
        >
          {skill === "comando" && phase === "comando" && <span className="t-kicker text-ink">Comando</span>}
          <QuestionBlocks blocks={q.command} />
        </div>

        {skill === "comando" && phase === "comando" && (
          <Button type="button" onClick={() => setPhase("evidencia")} icon={<Eye aria-hidden className="size-4" />}>
            Liberar o texto
          </Button>
        )}

        {skill === "comando" && phase === "evidencia" && (
          <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
            <p className="flex items-center gap-2 t-ui">
              <Highlighter aria-hidden className="size-4" /> Selecione no texto o trecho que responde ao comando (até 3).
            </p>
            {ranges.length > 0 && (
              <ul className="flex flex-col gap-2">
                {ranges.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-control bg-surface-subtle px-3 py-2 t-meta text-ink">
                    <span className="flex-1">“{r.quote}”</span>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-surface hover:text-ink"
                      onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden className="size-4" />
                      <span className="sr-only">Remover trecho</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ranges.length === 0 && (
              <fieldset className="flex flex-wrap items-center gap-2 t-meta text-ink-2">
                <legend className="sr-only">Sem trecho no texto</legend>
                <span>Sem trecho no texto?</span>
                {(Object.keys(NONE_LABEL) as (keyof typeof NONE_LABEL)[]).map((k) => (
                  <label
                    key={k}
                    className={clsx(
                      "inline-flex min-h-9 cursor-pointer items-center rounded-control border px-3",
                      none === k ? "border-ink text-ink" : "border-line-subtle hover:border-line",
                    )}
                  >
                    <input type="radio" name={`sem-${entry.id}`} className="sr-only" checked={none === k} onChange={() => setNone(k)} />
                    {NONE_LABEL[k]}
                  </label>
                ))}
              </fieldset>
            )}
            <Button type="button" className="self-start" loading={busy} disabled={!ranges.length && !none} onClick={() => void toAnswers()} icon={<ArrowRight aria-hidden className="size-4" />}>
              Ir para as alternativas
            </Button>
          </div>
        )}

        {(phase === "resposta" || phase === "classificacao" || phase === "retorno") && (
          <motion.div initial={skill === "comando" ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={T} className="flex flex-col gap-4">
            <Alternatives
              name={`alt-${entry.id}`}
              labelledBy={`cmd-${entry.id}`}
              items={q.alternatives.map((a) => ({
                key: a.key,
                letter: a.letter,
                content: (
                  <span className="flex flex-col gap-2">
                    <QuestionBlocks blocks={a.blocks} zoom={false} />
                  </span>
                ),
              }))}
              value={value}
              onValueChange={(k) => phase === "resposta" && setValue(k)}
              eliminated={eliminated}
              onToggleEliminate={(k) =>
                phase === "resposta" &&
                setEliminated((s) => {
                  const n = new Set(s);
                  if (n.has(k)) n.delete(k);
                  else n.add(k);
                  return n;
                })
              }
              confirmed={phase !== "resposta"}
              reveal={correctKey ? { correctKey } : null}
            />
            {phase === "resposta" && (
              <Button type="button" className="self-start" disabled={!value} loading={busy} onClick={() => void confirm()}>
                Confirmar resposta
              </Button>
            )}
          </motion.div>
        )}
      </article>

      <div aria-live="assertive">{error && <p role="alert" className="t-ui">{error}</p>}</div>

      {phase === "classificacao" && (
        <section aria-labelledby="classificar" className="flex max-w-[72ch] flex-col gap-4">
          <div>
            <h2 id="classificar" className="t-section">
              {value === correctKey ? "Você acertou." : `A resposta é ${letterOf(correctKey!)}.`} Por que as outras atraem?
            </h2>
            <p className="mt-1 t-meta text-ink-2">
              Um distrator é uma alternativa errada feita para atrair um raciocínio. Para cada uma, escolha o tipo que melhor descreve o
              erro; &quot;Não sei&quot; também vale.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {wrong.map((a) => (
              <li key={a.key} className="flex flex-col gap-2 border-t border-line-subtle pt-3">
                <p className="t-ui">
                  <span className="mr-2 font-semibold">{a.letter}</span>
                  <span className="text-ink-2">
                    <QuestionBlocks blocks={a.blocks} zoom={false} />
                  </span>
                </p>
                <label className="flex flex-col gap-1 t-meta">
                  <span className="sr-only">Tipo de distrator da alternativa {a.letter}</span>
                  <select
                    value={choices[a.key] ?? ""}
                    onChange={(e) => setChoices((c) => ({ ...c, [a.key]: e.target.value }))}
                    className="min-h-11 max-w-md rounded-control border border-line bg-surface px-3 t-ui text-ink"
                  >
                    <option value="">Escolha um tipo…</option>
                    {taxonomy.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                    <option value="nao_sei">Não sei</option>
                  </select>
                </label>
                {choices[a.key] && choices[a.key] !== "nao_sei" && (
                  <p className="t-meta text-ink-2">{taxonomy.find((t) => t.code === choices[a.key])?.definition}</p>
                )}
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Por quê? (opcional)"
                  value={notes[a.key] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.key]: e.target.value }))}
                  className="min-h-11 max-w-xl rounded-control border border-line-subtle bg-surface px-3 t-meta text-ink"
                  aria-label={`Justificativa da alternativa ${a.letter} (opcional)`}
                />
              </li>
            ))}
          </ul>
          <Button type="button" className="self-start" loading={busy} disabled={wrong.some((a) => !choices[a.key])} onClick={() => void compare()}>
            Comparar com a revisão
          </Button>
        </section>
      )}

      {phase === "retorno" && (
        <motion.section
          aria-labelledby="retorno"
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : duration.evidence / 1000, ease: ease.evidence }}
          className="flex max-w-[72ch] flex-col gap-4 border-l-2 border-ink pl-5"
        >
          <h2 id="retorno" className="t-section">
            {value === correctKey ? "Resposta certa." : `Resposta: ${letterOf(correctKey!)}. Você marcou ${letterOf(value!)}.`}
          </h2>
          {skill === "comando" &&
            (result?.annotationStatus === "pendentes" || !result?.evidence ? (
              <p className="t-reading text-ink-2">
                Comparação da evidência indisponível: as evidências desta questão ainda não foram revisadas. Seu trecho ficou guardado e entra na
                comparação quando a revisão existir.
              </p>
            ) : evidenceCmp ? (
              <div className="flex flex-col gap-2">
                <p className="t-reading text-ink">
                  {evidenceCmp.matched ? "Seu trecho corresponde à evidência revisada." : "Seu trecho não corresponde à evidência revisada."}{" "}
                  <span className="t-meta text-ink-2">
                    Cobertura {Math.round(evidenceCmp.bestCoverage * 100)}% · dentro da evidência {Math.round(evidenceCmp.precision * 100)}% (regra {EVIDENCE_RULE}).
                  </span>
                </p>
                <p className="t-meta text-ink-2">No texto: amarelo é o que você marcou; sublinhado azul é a evidência revisada.</p>
                {result.evidence.map((e, i) => e.rationale && <p key={i} className="t-meta text-ink">{e.rationale}</p>)}
              </div>
            ) : (
              <p className="t-reading text-ink-2">Você indicou que a resposta não está num trecho do texto ({NONE_LABEL[none ?? "nao_encontrei"].toLowerCase()}).</p>
            ))}
          {skill === "distrator" &&
            (result?.annotationStatus === "pendentes" || !result?.distractors ? (
              <div className="flex flex-col gap-2">
                <p className="t-reading text-ink-2">
                  Comparação indisponível: os distratores desta questão ainda não foram revisados. Sua classificação ficou guardada.
                </p>
                <ul className="flex flex-col gap-1 t-meta">
                  {rows.map((r) => (
                    <li key={r.key}>
                      {letterOf(r.key)}: {typeLabel(r.mine)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((r) => (
                  <li key={r.key} className="flex flex-col gap-0.5">
                    <p className="t-ui">
                      <span className="mr-2 font-semibold">{letterOf(r.key)}</span>
                      Você: {typeLabel(r.mine)} · Revisão: {r.editorial?.label ?? "sem etiqueta"}
                      {r.agrees !== null && (
                        <span className={clsx("ml-2 rounded-full px-2 py-0.5 t-meta", r.agrees ? "bg-mark-yellow text-on-mark" : "bg-surface-subtle text-ink")}>
                          {r.agrees ? "igual" : "diferente"}
                        </span>
                      )}
                    </p>
                    {r.editorial?.rationale && <p className="t-meta text-ink-2">{r.editorial.rationale}</p>}
                  </li>
                ))}
              </ul>
            ))}
          <Button type="button" className="self-start" onClick={next} icon={<ArrowRight aria-hidden className="size-4" />}>
            {index + 1 < entries.length ? "Próxima questão" : "Ver resumo"}
          </Button>
        </motion.section>
      )}
    </div>
  );
}
