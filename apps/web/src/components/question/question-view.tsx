"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { Maximize2, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Alternatives, type Reveal } from "@/components/ui/alternatives";
import {
  AREA_LABEL,
  type QuestionBlock,
  type StudyQuestion,
} from "@/lib/study/question-types";

/** Figura com ampliação (F1-T05). Sem link: aparece como indisponível, sem inventar conteúdo. */
export function QuestionFigure({
  figure,
  label,
}: {
  figure: NonNullable<QuestionBlock["figure"]>;
  label: string;
}) {
  if (!figure.url) {
    return (
      <p className="rounded-card border border-line-subtle bg-surface-subtle p-3 t-meta text-ink-2">
        Figura indisponível no momento.
      </p>
    );
  }
  return (
    <figure className="flex flex-col items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração */}
      <img
        src={figure.url}
        alt={figure.alt ?? ""}
        loading="lazy"
        className="h-auto max-w-full rounded-control border border-line-subtle"
      />
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 t-meta text-ink-2 hover:bg-surface-subtle hover:text-ink pointer-fine:min-h-9"
          >
            <Maximize2 aria-hidden="true" className="size-4" /> Ampliar {label}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--rs-scrim)]" />
          <Dialog.Content className="fixed inset-2 z-50 flex flex-col gap-3 overflow-auto rounded-panel border border-line-subtle bg-surface p-3 shadow-paper outline-none sm:inset-6 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="t-ui font-semibold">
                {label[0]!.toUpperCase() + label.slice(1)} ampliada
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink"
                >
                  <X aria-hidden="true" className="size-5" />
                  <span className="sr-only">Fechar</span>
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description
              className={figure.alt ? "t-meta text-ink-2" : "sr-only"}
            >
              {figure.alt ?? "Figura sem descrição textual."}
            </Dialog.Description>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração */}
              <img
                src={figure.url}
                alt={figure.alt ?? ""}
                className="h-auto w-full max-w-5xl object-contain"
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </figure>
  );
}

/** Blocos de texto-base e comando, na ordem da fonte. */
export function QuestionBlocks({
  blocks,
  zoom = true,
}: {
  blocks: QuestionBlock[];
  zoom?: boolean;
}) {
  const figureNo = new Map(
    blocks.filter((b) => b.type === "image").map((b, i) => [b.id, i + 1]),
  );
  // Sem ampliação = dentro do rótulo da alternativa: só conteúdo de frase (span), nada interativo.
  const P = zoom ? "p" : "span";
  return (
    <>
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return (
              <P key={b.id} className="block font-semibold">
                {b.text}
              </P>
            );
          case "source":
            return (
              <P key={b.id} className="block t-meta text-ink-2">
                {b.text}
              </P>
            );
          case "table": {
            const rows = tableRows(b.text);
            if (rows)
              return (
                <span key={b.id} className="block overflow-x-auto">
                  <table className="w-full border-collapse t-ui">
                    <thead>
                      <tr>
                        {rows[0]!.map((c, i) => (
                          <th key={i} scope="col" className="border border-line bg-surface-subtle px-3 py-2 text-left font-semibold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(1).map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td key={j} className="border border-line px-3 py-2 tabular">
                              {c || <span className="sr-only">vazio</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </span>
              );
            return (
              <span key={b.id} className="block overflow-x-auto whitespace-pre-wrap rounded-control bg-surface-subtle p-3">
                {b.text}
              </span>
            );
          }
          case "formula":
            return (
              <span
                key={b.id}
                className="block overflow-x-auto whitespace-pre-wrap rounded-control bg-surface-subtle p-3"
              >
                {b.text}
              </span>
            );
          case "image":
            return zoom ? (
              <QuestionFigure
                key={b.id}
                figure={b.figure!}
                label={`figura ${figureNo.get(b.id)}`}
              />
            ) : b.figure?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração
              <img
                key={b.id}
                src={b.figure.url}
                alt={b.figure.alt ?? ""}
                className="h-auto max-w-full rounded-control border border-line-subtle"
              />
            ) : (
              <span key={b.id} className="t-meta text-ink-2">
                Figura indisponível.
              </span>
            );
          default: {
            const numbered = numberedLines(b.text);
            if (numbered)
              // linhas numeradas do caderno: número na margem, texto com recuo (a referência "linha 12" continua valendo)
              return (
                <span key={b.id} className="block">
                  {numbered.map(([n, line]) => (
                    <span key={n} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
                      <span aria-hidden className="select-none pt-[0.2em] text-right t-meta tabular text-ink-2">
                        {n}
                      </span>
                      <span>
                        <span className="sr-only">linha {n}: </span>
                        {line}
                      </span>
                    </span>
                  ))}
                </span>
              );
            // quebras de linha do texto são do original (listas): preservadas
            return (
              <P key={b.id} className="block whitespace-pre-line">
                {b.text}
              </P>
            );
          }
        }
      })}
    </>
  );
}

/** Bloco de linhas numeradas ("12 texto"), uma por quebra de linha; null se não for esse o formato. */
export function numberedLines(text: string | undefined): [string, string][] | null {
  const lines = (text ?? "").split("\n");
  if (lines.length < 2) return null;
  const out = lines.map((l) => /^(\d{1,3}) (.*)$/.exec(l));
  return out.every(Boolean) ? out.map((m) => [m![1]!, m![2]!]) : null;
}

/**
 * Tabela em texto: uma linha por quebra de linha e células separadas por " | " (a primeira linha é o
 * cabeçalho). Devolve null quando o texto não tem esse formato, e o bloco aparece pré-formatado.
 */
export function tableRows(text: string | undefined): string[][] | null {
  const lines = (text ?? "").split("\n").filter((l) => l.trim());
  if (lines.length < 2 || !lines.every((l) => l.includes(" | "))) return null;
  const rows = lines.map((l) => l.split(" | ").map((c) => c.trim()));
  return rows.every((r) => r.length === rows[0]!.length) ? rows : null;
}

/** [3, 4, 5] → "3, 4 e 5". */
function sharedList(ps: number[]) {
  return ps.length < 2 ? String(ps[0] ?? "") : `${ps.slice(0, -1).join(", ")} e ${ps[ps.length - 1]}`;
}

export interface AnswerState {
  value: string | null;
  onValueChange: (key: string) => void;
  eliminated: ReadonlySet<string>;
  onToggleEliminate: (key: string) => void;
  confirmed: boolean;
  reveal: Reveal;
}

/**
 * Questão real: página de caderno. Quando há espaço (PC) e texto-base, abre em página dupla — texto à
 * esquerda, comando e alternativas à direita, sempre à vista enquanto se lê. Em telas estreitas, uma
 * coluna na ordem da fonte. Nada se move durante a leitura; figuras ampliam por ação.
 */
export function QuestionView({
  question,
  answer,
  badge,
}: {
  question: StudyQuestion;
  answer: AnswerState;
  badge?: ReactNode;
}) {
  const id = useId();
  const collapsed = Boolean(question.shared && !question.shared.first);
  const spread = question.stimulus.length > 0 && !collapsed;
  return (
    <div className="@container">
      <article
        aria-labelledby={`${id}-cmd`}
        className={clsx(
          "relative max-w-[72ch] rounded-panel border border-line-subtle bg-surface p-4 shadow-paper sm:p-7",
          spread && "@[62rem]:grid @[62rem]:max-w-none @[62rem]:grid-cols-2 @[62rem]:gap-x-0 @[62rem]:p-0",
        )}
      >
        <div className={clsx("mb-4 flex flex-wrap items-center gap-x-2 gap-y-1", spread && "@[62rem]:col-span-2 @[62rem]:mb-0 @[62rem]:border-b @[62rem]:border-line-subtle @[62rem]:px-8 @[62rem]:py-3")}>
          <span className="t-kicker">
            {AREA_LABEL[question.area]}<span aria-hidden="true"> ·</span>
          </span>
          <span className="t-kicker font-normal">{question.origin}</span>
          {badge}
        </div>
        {question.stimulus.length > 0 &&
          (collapsed ? (
            <details className="group mb-5 rounded-card border border-line-subtle bg-surface-subtle">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 t-ui text-ink">
                <span>
                  Mesmo texto da questão {question.shared!.positions[0]}{" "}
                  <span className="t-meta text-ink-2">(texto para as questões {sharedList(question.shared!.positions)})</span>
                </span>
                <span className="t-meta text-link group-open:hidden">Mostrar</span>
                <span className="hidden t-meta text-link group-open:inline">Recolher</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-line-subtle bg-surface px-4 py-4 t-reading text-ink">
                <QuestionBlocks blocks={question.stimulus} />
              </div>
            </details>
          ) : (
            <div className="mb-5 flex flex-col gap-4 t-reading text-ink @[62rem]:mb-0 @[62rem]:border-r @[62rem]:border-line-subtle @[62rem]:px-8 @[62rem]:py-7">
              {question.shared && (
                <p className="t-meta font-medium text-ink-2">Texto para as questões {sharedList(question.shared.positions)}</p>
              )}
              <QuestionBlocks blocks={question.stimulus} />
            </div>
          ))}
        <div className={clsx(spread && "@[62rem]:sticky @[62rem]:top-6 @[62rem]:self-start @[62rem]:px-8 @[62rem]:py-7")}>
          <div id={`${id}-cmd`} className="mb-3 flex flex-col gap-3 t-reading font-medium text-ink">
            <QuestionBlocks blocks={question.command} />
          </div>
          <Alternatives
            name={`${id}-alt`}
            labelledBy={`${id}-cmd`}
            items={question.alternatives.map((a) => ({
              key: a.key,
              letter: a.letter,
              content: (
                <span className="inline-flex flex-col gap-2 align-top">
                  <QuestionBlocks blocks={a.blocks} zoom={false} />
                </span>
              ),
            }))}
            {...answer}
          />
        </div>
      </article>
    </div>
  );
}
