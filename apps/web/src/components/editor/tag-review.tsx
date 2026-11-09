"use client";

import { clsx } from "clsx";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import type { TagReviewContext } from "@/lib/editor/data";
import { LETTER_LIST, textProblem, type Letter } from "@/lib/editor/payload";
import { checkTagReview, submitTagReview, type TagResult } from "@/lib/editor/tag-actions";
import { CHECKLIST, DEPENDENCY, locateQuote, type Evidence, type Tags } from "@/lib/editor/tags";

const selectClass = "min-h-11 w-full rounded-control border border-line bg-surface px-3 t-ui text-ink";

export function TagReview({ ctx, initial }: { ctx: TagReviewContext; initial: { tags: Tags; origin: string } }) {
  const router = useRouter();
  const p = ctx.proposal;
  const payload = p.payload;
  const answer = ctx.answer;
  const wrong = answer && /^[A-E]$/.test(answer) ? LETTER_LIST.filter((l) => l !== answer) : [];
  const textBlocks = [...payload.stimulus_blocks, ...payload.command_blocks].filter((b) => typeof b.text === "string" && b.text.length > 0);

  const [tags, setTags] = useState<Tags>(() => ({
    ...initial.tags,
    distractors: wrong.map((l) => initial.tags.distractors.find((d) => d.letter === l) ?? { letter: l, type: "", secondary_type: null, rationale: "" }),
  }));
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<TagResult | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Tags>(k: K, v: Tags[K]) => setTags((t) => ({ ...t, [k]: v }));
  const input = (decision: "aprovar" | "devolver" | "rejeitar") => ({
    proposalId: p.id,
    proposalRevision: p.current_revision,
    decision,
    tags: { ...tags, distractors: tags.distractors.filter((d) => wrong.includes(d.letter)) },
    checklist,
    notes,
    suggestionId: ctx.suggestion?.id ?? null,
  });
  const run = (fn: () => Promise<TagResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok && r.decision !== "pronta para aprovar") router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <QuestionText payload={payload} answer={answer} onAddEvidence={(e) => set("evidence", [...tags.evidence, e])} blocks={textBlocks} />

      <form
        className="flex flex-col gap-6"
        aria-labelledby="etiquetas-title"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => submitTagReview(input("aprovar")));
        }}
      >
        <div>
          <h2 id="etiquetas-title" className="t-section">
            Etiquetas
          </h2>
          <p className="mt-1 t-meta text-ink-2">Ponto de partida: {initial.origin}.</p>
          {ctx.openDoubts > 0 && (
            <p className="mt-2 rounded-card bg-mark-yellow px-3 py-2 t-meta text-on-mark">
              Há {ctx.openDoubts} dúvida(s) aberta(s) no conteúdo: resolva antes de aprovar.{" "}
              <Link href={`/editor/proposta/${p.id}`} className="underline underline-offset-4">
                Ir para o conteúdo
              </Link>
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Habilidade da Matriz ({payload.area})</legend>
          <SkillSelect label="Habilidade principal" value={tags.skill?.code ?? ""} skills={ctx.skills} onChange={(v) => set("skill", v ? { code: v } : null)} required />
          <SkillSelect label="Habilidade secundária (opcional)" value={tags.secondary_skill?.code ?? ""} skills={ctx.skills} onChange={(v) => set("secondary_skill", v ? { code: v } : null)} />
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Dependência de conteúdo</legend>
          {DEPENDENCY.map((d) => (
            <label key={d.level} className="flex min-h-11 items-center gap-3 t-ui">
              <input type="radio" name="dependencia" className="size-5 accent-[var(--rs-primary)]" checked={tags.content_dependency === d.level} onChange={() => set("content_dependency", d.level)} />
              {d.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Assunto</legend>
          <TextArea
            label="Justificativa da ausência de assunto"
            hint="A lista de assuntos ainda não existe; a ausência precisa de justificativa."
            value={tags.subjects.absent_reason}
            rows={2}
            error={textProblem(tags.subjects.absent_reason) ?? undefined}
            onChange={(e) => set("subjects", { ...tags.subjects, absent_reason: e.target.value })}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Evidências da resposta</legend>
          {tags.evidence.length === 0 && <p className="t-meta text-ink-2">Nenhuma evidência ainda. Selecione um trecho no texto da questão ou cole-o abaixo.</p>}
          {tags.evidence.map((ev, i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-line-subtle pt-3 first-of-type:border-0 first-of-type:pt-0">
              <p className="t-ui">
                {ev.type === "text" ? (
                  <>
                    Bloco {ev.block_id}: <q>{ev.quote}</q>
                  </>
                ) : (
                  <>Figura {ev.figure_id}</>
                )}
              </p>
              <TextArea
                label={`Por que este trecho sustenta a resposta (evidência ${i + 1})`}
                value={ev.rationale}
                rows={2}
                error={textProblem(ev.rationale) ?? undefined}
                onChange={(e) => set("evidence", tags.evidence.map((x, j) => (j === i ? { ...x, rationale: e.target.value } : x)))}
              />
              <Button type="button" variant="ghost" size="sm" className="self-start" icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => set("evidence", tags.evidence.filter((_, j) => j !== i))}>
                Remover evidência {i + 1}
              </Button>
            </div>
          ))}
          <PasteEvidence blocks={textBlocks} figures={payload.figures.map((f) => f.id)} onAdd={(e) => set("evidence", [...tags.evidence, e])} />
          <TextArea
            label="Ou: justificativa da ausência de evidência"
            hint="Use só quando a resposta não se apoia em trecho ou figura da questão."
            value={tags.evidence_absent_reason}
            rows={2}
            error={textProblem(tags.evidence_absent_reason) ?? undefined}
            onChange={(e) => set("evidence_absent_reason", e.target.value)}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Distratores</legend>
          {!answer || answer === "ANULADO" ? (
            <p className="t-meta text-ink">{answer === "ANULADO" ? "Questão anulada no gabarito oficial: não há distratores a etiquetar e ela fica fora da publicação." : "Gabarito oficial indisponível para esta questão."}</p>
          ) : (
            tags.distractors.map((d, i) => (
              <div key={d.letter} className="flex flex-col gap-2 border-t border-line-subtle pt-4 first-of-type:border-0 first-of-type:pt-0">
                <p className="t-ui">
                  Alternativa {d.letter}: <span className="font-normal">{altText(payload.alternatives[d.letter as Letter])}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TypeSelect label={`Tipo principal (${d.letter})`} value={d.type} types={ctx.distractorTypes} onChange={(v) => set("distractors", tags.distractors.map((x, j) => (j === i ? { ...x, type: v } : x)))} />
                  <TypeSelect
                    label={`Tipo secundário (${d.letter}, opcional)`}
                    value={d.secondary_type ?? ""}
                    types={ctx.distractorTypes}
                    allowEmpty
                    onChange={(v) => set("distractors", tags.distractors.map((x, j) => (j === i ? { ...x, secondary_type: v || null } : x)))}
                  />
                </div>
                <TextArea
                  label={`Justificativa editorial (${d.letter})`}
                  hint="O que torna a alternativa atraente e por que está errada. Análise do Resolve, não do elaborador."
                  value={d.rationale}
                  rows={2}
                  error={textProblem(d.rationale) ?? undefined}
                  onChange={(e) => set("distractors", tags.distractors.map((x, j) => (j === i ? { ...x, rationale: e.target.value } : x)))}
                />
              </div>
            ))
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Resolução comentada</legend>
          {tags.explanation.steps.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-2">
              <TextArea
                label={`Passo ${i + 1}`}
                value={s.text}
                rows={2}
                error={textProblem(s.text) ?? undefined}
                onChange={(e) => set("explanation", { ...tags.explanation, steps: tags.explanation.steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
              <Button type="button" variant="ghost" size="sm" className="self-start" icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => set("explanation", { ...tags.explanation, steps: tags.explanation.steps.filter((_, j) => j !== i) })}>
                Remover passo {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            icon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => {
              let n = tags.explanation.steps.length + 1;
              while (tags.explanation.steps.some((s) => s.id === `p${n}`)) n += 1;
              set("explanation", { ...tags.explanation, steps: [...tags.explanation.steps, { id: `p${n}`, text: "" }] });
            }}
          >
            Adicionar passo
          </Button>
          <TextArea
            label="Ou: justificativa da ausência de resolução"
            value={tags.explanation.absent_reason}
            rows={2}
            error={textProblem(tags.explanation.absent_reason) ?? undefined}
            onChange={(e) => set("explanation", { ...tags.explanation, absent_reason: e.target.value })}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-1 rounded-panel border border-line bg-surface p-4 sm:p-5">
          <legend className="px-1 t-ui">Checklist de aprovação</legend>
          {CHECKLIST.map((c) => (
            <label key={c.key} className="flex min-h-11 items-center gap-3 t-ui">
              <input type="checkbox" className="size-5 accent-[var(--rs-primary)]" checked={checklist[c.key] === true} onChange={(e) => setChecklist((x) => ({ ...x, [c.key]: e.target.checked }))} />
              {c.label}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
          <TextArea label="Notas da revisão" hint="Obrigatórias para devolver ou rejeitar (mínimo de 10 caracteres)." value={notes} rows={2} error={textProblem(notes) ?? undefined} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => checkTagReview(input("aprovar")))}>
              Conferir pendências
            </Button>
            <Button type="submit" loading={pending}>
              Aprovar etiquetas
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => submitTagReview(input("devolver")))}>
              Devolver para correção
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => submitTagReview(input("rejeitar")))}>
              Rejeitar questão
            </Button>
          </div>
          <div aria-live="polite">
            {result?.ok === true && (
              <p className="flex items-center gap-2 t-ui">
                <CheckCircle2 aria-hidden="true" className="size-5" />
                {result.decision === "pronta para aprovar" ? "Nenhuma pendência: pronta para aprovar." : `Decisão registrada: ${result.decision}.`}
              </p>
            )}
            {result?.ok === false && (
              <div>
                <p className="t-ui">Pendências ({result.problems.length}):</p>
                <ul className="mt-1 list-disc pl-6 t-meta text-ink">
                  {result.problems.map((pr) => (
                    <li key={pr}>{pr}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <PreviousReviews reviews={ctx.reviews} userId={ctx.userId} />
      </form>
    </div>
  );
}

function altText(blocks: { type: string; text?: string; asset_ref?: string }[]) {
  return blocks.map((b) => (b.type === "image" ? `[figura ${b.asset_ref}]` : b.text)).join(" ") || "(sem texto)";
}

function SkillSelect({ label, value, skills, onChange, required }: { label: string; value: string; skills: TagReviewContext["skills"]; onChange: (v: string) => void; required?: boolean }) {
  const id = useId();
  const chosen = skills.find((s) => s.code === value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="t-ui">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {skills.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code} · {s.description.slice(0, 90)}
            {s.description.length > 90 ? "…" : ""}
          </option>
        ))}
      </select>
      {chosen && <p className="t-meta text-ink-2">{chosen.description}</p>}
    </div>
  );
}

function TypeSelect({ label, value, types, onChange, allowEmpty }: { label: string; value: string; types: TagReviewContext["distractorTypes"]; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const id = useId();
  const chosen = types.find((t) => t.code === value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="t-ui">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allowEmpty ? "Nenhum" : "Escolha…"}</option>
        {types.map((t) => (
          <option key={t.code} value={t.code}>
            {t.label}
          </option>
        ))}
      </select>
      {chosen && <p className="t-meta text-ink-2">{chosen.definition}</p>}
    </div>
  );
}

/** Texto da questão, com seleção de trecho como evidência (offsets do próprio navegador, em UTF-16). */
function QuestionText({ payload, answer, blocks, onAddEvidence }: { payload: TagReviewContext["proposal"]["payload"]; answer: string | null; blocks: { id: string; text?: string }[]; onAddEvidence: (e: Evidence) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  function addSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return setMsg("Selecione um trecho em um dos blocos do texto.");
    const range = sel.getRangeAt(0);
    const a = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>("[data-block-id]");
    const b = (range.endContainer.parentElement ?? null)?.closest<HTMLElement>("[data-block-id]");
    if (!a || a !== b || !ref.current?.contains(a) || range.startContainer !== range.endContainer) return setMsg("O trecho precisa estar dentro de um único bloco.");
    const id = a.dataset.blockId!;
    const quote = range.toString();
    onAddEvidence({ type: "text", block_id: id, start_utf16: range.startOffset, end_utf16: range.endOffset, quote, rationale: "" });
    setMsg(`Trecho do bloco ${id} adicionado às evidências.`);
    sel.removeAllRanges();
  }
  return (
    <section aria-labelledby="questao-title" tabIndex={0} className="rounded-card lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <h2 id="questao-title" className="mb-2 t-section">
        Texto da questão
      </h2>
      <p className="mb-3 flex items-center gap-2 t-ui">
        {answer && /^[A-E]$/.test(answer) ? (
          <>
            <CheckCircle2 aria-hidden="true" className="size-5" /> Gabarito oficial: {answer}
          </>
        ) : answer === "ANULADO" ? (
          "Gabarito oficial: anulada"
        ) : (
          "Gabarito oficial indisponível"
        )}
      </p>
      <div ref={ref} className="flex flex-col gap-3 rounded-card border border-line-subtle bg-surface p-4">
        {blocks.map((b) => (
          <div key={b.id}>
            <p className="t-meta text-ink-2">Bloco {b.id}</p>
            <p data-block-id={b.id} className="t-reading whitespace-pre-line">
              {b.text}
            </p>
          </div>
        ))}
        <ol className="flex flex-col gap-1 border-t border-line-subtle pt-3">
          {LETTER_LIST.map((k) => (
            <li key={k} className={clsx("t-ui font-normal", k === answer && "font-semibold")}>
              {k}) {altText(payload.alternatives[k])}
              {k === answer ? " (correta)" : ""}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={addSelection}>
          Usar trecho selecionado como evidência
        </Button>
        <span aria-live="polite" className="t-meta text-ink">
          {msg}
        </span>
      </div>
    </section>
  );
}

/** Caminho por teclado: escolher o bloco e colar o trecho literal. */
function PasteEvidence({ blocks, figures, onAdd }: { blocks: { id: string; text?: string }[]; figures: string[]; onAdd: (e: Evidence) => void }) {
  const blockId = useId();
  const figId = useId();
  const [block, setBlock] = useState(blocks[0]?.id ?? "");
  const [quote, setQuote] = useState("");
  const [figure, setFigure] = useState(figures[0] ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-subtle p-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={blockId} className="t-ui">
          Bloco do trecho
        </label>
        <select id={blockId} className={selectClass} value={block} onChange={(e) => setBlock(e.target.value)}>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {(b.text ?? "").slice(0, 60)}
            </option>
          ))}
        </select>
      </div>
      <TextArea label="Trecho literal (colar)" value={quote} rows={2} onChange={(e) => setQuote(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const text = blocks.find((b) => b.id === block)?.text ?? "";
            const r = locateQuote(text, quote);
            if ("error" in r) return setMsg(r.error);
            onAdd({ type: "text", block_id: block, start_utf16: r.start, end_utf16: r.end, quote: quote.trim(), rationale: "" });
            setQuote("");
            setMsg("Trecho adicionado às evidências.");
          }}
        >
          Adicionar trecho colado
        </Button>
        {figures.length > 0 && (
          <>
            <label htmlFor={figId} className="sr-only">
              Figura usada como evidência
            </label>
            <select id={figId} className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui" value={figure} onChange={(e) => setFigure(e.target.value)}>
              {figures.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" size="sm" onClick={() => onAdd({ type: "figure", figure_id: figure, rationale: "" })}>
              Adicionar figura como evidência
            </Button>
          </>
        )}
        <span aria-live="polite" className="t-meta text-ink">
          {msg}
        </span>
      </div>
    </div>
  );
}

function PreviousReviews({ reviews, userId }: { reviews: TagReviewContext["reviews"]; userId: string }) {
  if (reviews.length === 0) return null;
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const label = { aprovar: "Aprovada", devolver: "Devolvida", rejeitar: "Rejeitada" } as const;
  return (
    <section aria-labelledby="revisoes-etiquetas" className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
      <h2 id="revisoes-etiquetas" className="mb-3 t-section">
        Decisões anteriores
      </h2>
      <ol className="flex flex-col gap-3">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-card border border-line-subtle p-3">
            <p className="t-ui">
              {label[r.decision]} · conteúdo na revisão {r.proposal_revision}
            </p>
            <p className="t-meta text-ink-2">
              {fmt.format(new Date(r.created_at))} · {r.reviewer_id === userId ? "você" : "outro editor"}
            </p>
            {r.notes && <p className="mt-1 t-meta text-ink">{r.notes}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
