"use client";

import { clsx } from "clsx";
import { History, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { closeDoubt, saveRevision, type SaveResult } from "@/lib/editor/actions";
import type { Doubt, PageImage, ProposalDetail, Revision } from "@/lib/editor/data";
import { LETTER_LIST, textProblem, type Block, type Figure, type Letter, type ProposalPayload } from "@/lib/editor/payload";

type Draft = Pick<ProposalPayload, "stimulus_blocks" | "command_blocks" | "alternatives" | "figures">;

const TEXT_TYPES = new Set(["paragraph", "heading", "source", "formula"]);
const TYPE_LABEL: Record<string, string> = { paragraph: "parágrafo", heading: "título", source: "fonte", formula: "fórmula", image: "figura", table: "tabela" };

function draftOf(p: ProposalPayload): Draft {
  return structuredClone({ stimulus_blocks: p.stimulus_blocks, command_blocks: p.command_blocks, alternatives: p.alternatives, figures: p.figures });
}

function nextBlockId(blocks: Block[], prefix: string) {
  let n = blocks.length + 1;
  while (blocks.some((b) => b.id === `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function ProposalReview({ detail, viewing, saved }: { detail: ProposalDetail; viewing: { revision: number; payload: ProposalPayload } | null; saved: Revision | null }) {
  const router = useRouter();
  const payload = viewing?.payload ?? detail.proposal.payload;
  const readOnly = viewing !== null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(payload));
  const [note, setNote] = useState("");
  const [selectedFigure, setSelectedFigure] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const setBlocks = (key: "stimulus_blocks" | "command_blocks", blocks: Block[]) => setDraft((d) => ({ ...d, [key]: blocks }));
  const setAlt = (k: Letter, blocks: Block[]) => setDraft((d) => ({ ...d, alternatives: { ...d.alternatives, [k]: blocks } }));
  const setFigure = (id: string, patch: Partial<Figure>) => setDraft((d) => ({ ...d, figures: d.figures.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));

  function save() {
    // A ação é registrada antes de qualquer resposta visual (§8): o estado "salvando" vem do servidor.
    startTransition(async () => {
      const r = await saveRevision({ proposalId: detail.proposal.id, expectedRevision: detail.proposal.current_revision, note, ...draft });
      setResult(r);
      // A confirmação vem do histórico recarregado (?salvo=N), então sobrevive à recarga dos dados.
      if (r.ok) router.replace(`/editor/proposta/${detail.proposal.id}?salvo=${r.revision}`, { scroll: false });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <section aria-labelledby="pdf-title" tabIndex={0} className="rounded-card lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
        <h2 id="pdf-title" className="mb-2 t-section">
          Original (PDF)
        </h2>
        <p className="mb-3 t-meta text-ink-2">Contorno contínuo: área da questão. Tracejado: figuras recortadas.</p>
        {detail.pages.length === 0 ? (
          <p className="t-meta text-ink-2">Imagem da página indisponível.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {detail.pages.map((pg) => (
              <PageWithBoxes key={pg.page} page={pg} payload={payload} figures={draft.figures} selected={selectedFigure} />
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-6">
        {saved && !readOnly && (
          <p role="status" className="rounded-card border border-ink bg-surface p-4 t-ui">
            Revisão {saved.revision} salva ({saved.changed.join(", ")}).
          </p>
        )}
        {readOnly && (
          <div role="status" className="rounded-card border border-ink bg-surface p-4">
            <p className="t-ui">Revisão {viewing.revision}, somente leitura.</p>
            <Link href={`/editor/proposta/${detail.proposal.id}`} className="mt-1 inline-flex min-h-11 items-center t-ui text-link underline underline-offset-4">
              Voltar para a revisão atual ({detail.proposal.current_revision})
            </Link>
          </div>
        )}

        <Doubts doubts={detail.doubts} proposalId={detail.proposal.id} readOnly={readOnly} />

        <form
          aria-labelledby="extracao-title"
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h2 id="extracao-title" className="t-section">
            Extração
          </h2>

          <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5" disabled={readOnly}>
            <legend className="px-1 t-ui">Texto-base</legend>
            {draft.stimulus_blocks.length === 0 && <p className="t-meta text-ink-2">Sem texto-base.</p>}
            {draft.stimulus_blocks.map((b, i) =>
              TEXT_TYPES.has(b.type) || (b.type === "table" && !b.asset_ref) ? (
                <div key={b.id} className="flex flex-col gap-2">
                  <TextArea
                    label={`Bloco ${b.id} (${TYPE_LABEL[b.type]})`}
                    value={b.text ?? ""}
                    rows={Math.min(12, Math.max(2, Math.ceil((b.text ?? "").length / 70)))}
                    error={textProblem(b.text ?? "") ?? undefined}
                    onChange={(e) => setBlocks("stimulus_blocks", draft.stimulus_blocks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  />
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="sm" className="self-start" icon={<Trash2 aria-hidden="true" className="size-4" />}
                      onClick={() => setBlocks("stimulus_blocks", draft.stimulus_blocks.filter((_, j) => j !== i))}>
                      Remover bloco {b.id}
                    </Button>
                  )}
                </div>
              ) : (
                <p key={b.id} className="t-meta text-ink-2">
                  Bloco {b.id}: {TYPE_LABEL[b.type]} {b.asset_ref ? `(${b.asset_ref})` : ""}, editada em Figuras.
                </p>
              ),
            )}
            {!readOnly && (
              <Button type="button" variant="secondary" size="sm" className="self-start" icon={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setBlocks("stimulus_blocks", [...draft.stimulus_blocks, { id: nextBlockId(draft.stimulus_blocks, "s"), type: "paragraph", text: "" }])}>
                Adicionar parágrafo
              </Button>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5" disabled={readOnly}>
            <legend className="px-1 t-ui">Comando</legend>
            {draft.command_blocks.map((b, i) => (
              <TextArea
                key={b.id}
                label={draft.command_blocks.length > 1 ? `Comando, bloco ${b.id}` : "Comando"}
                value={b.text ?? ""}
                rows={2}
                error={textProblem(b.text ?? "") ?? (b.text?.trim() ? undefined : "Comando vazio: a proposta fica com dúvida.")}
                onChange={(e) => setBlocks("command_blocks", draft.command_blocks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5" disabled={readOnly}>
            <legend className="px-1 t-ui">Alternativas</legend>
            {LETTER_LIST.map((k) => (
              <div key={k} className="flex flex-col gap-2">
                {draft.alternatives[k].map((b, i) =>
                  b.type === "image" ? (
                    <p key={b.id} className="t-meta text-ink-2">
                      Alternativa {k}: figura {b.asset_ref}, editada em Figuras.
                    </p>
                  ) : (
                    <TextArea
                      key={b.id}
                      label={`Alternativa ${k}`}
                      value={b.text ?? ""}
                      rows={1}
                      error={textProblem(b.text ?? "") ?? undefined}
                      hint={!b.text?.trim() && !draft.alternatives[k].some((x) => x.type === "image") ? "Sem conteúdo: a proposta fica com dúvida." : undefined}
                      onChange={(e) => setAlt(k, draft.alternatives[k].map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    />
                  ),
                )}
              </div>
            ))}
          </fieldset>

          {draft.figures.length > 0 && (
            <fieldset className="flex flex-col gap-5 rounded-panel border border-line-subtle bg-surface p-4 sm:p-5" disabled={readOnly}>
              <legend className="px-1 t-ui">Figuras</legend>
              <p className="t-meta text-ink-2">
                Caixa em pontos do PDF (x inicial, topo, x final, base). Ao mudar a caixa, a figura é recortada de novo antes da publicação. O texto alternativo não pode revelar a resposta.
              </p>
              {draft.figures.map((f) => (
                <FigureEditor
                  key={f.id}
                  figure={f}
                  page={detail.pages.find((p) => p.page === f.page)}
                  originalUrl={detail.figureUrls[f.id]}
                  onChange={(patch) => setFigure(f.id, patch)}
                  onFocus={() => setSelectedFigure(f.id)}
                />
              ))}
            </fieldset>
          )}

          {!readOnly && (
            <div className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-5">
              <TextArea
                label="O que foi corrigido"
                hint="Fica no histórico junto com a revisão. Ex.: corrigido sinal na alternativa C conforme o PDF."
                value={note}
                rows={2}
                required
                minLength={3}
                maxLength={1000}
                error={textProblem(note) ?? undefined}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" loading={pending}>
                  Salvar revisão {detail.proposal.current_revision + 1}
                </Button>
                <p aria-live="polite" className="t-meta text-ink">
                  {result?.ok === false && result.message}
                </p>
              </div>
            </div>
          )}
        </form>

        <RevisionHistory revisions={detail.revisions} current={detail.proposal.current_revision} viewing={viewing?.revision ?? null} proposalId={detail.proposal.id} userId={detail.userId} />
      </div>
    </div>
  );
}

/** Página do PDF com a caixa da questão e das figuras sobrepostas (coordenadas da MediaBox). */
function PageWithBoxes({ page, payload, figures, selected }: { page: PageImage; payload: ProposalPayload; figures: Figure[]; selected: string | null }) {
  const text = payload.source.bbox_by_page[String(page.page)];
  // Área da questão = linhas de texto + figuras da página (figura de alternativa pode passar da última linha).
  const onPage = figures.filter((f) => f.page === page.page);
  const box = text
    ? ([
        Math.min(text[0], ...onPage.map((f) => f.bbox_pt[0])),
        Math.min(text[1], ...onPage.map((f) => f.bbox_pt[1])),
        Math.max(text[2], ...onPage.map((f) => f.bbox_pt[2])),
        Math.max(text[3], ...onPage.map((f) => f.bbox_pt[3])),
      ] as const)
    : null;
  const pct = ([x0, top, x1, bottom]: readonly [number, number, number, number]) => ({
    left: `${((x0 - page.dxPt) / page.cropWidthPt) * 100}%`,
    top: `${((top - page.dyPt) / page.cropHeightPt) * 100}%`,
    width: `${((x1 - x0) / page.cropWidthPt) * 100}%`,
    height: `${((bottom - top) / page.cropHeightPt) * 100}%`,
  });
  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-card border border-line-subtle bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração, sem otimização */}
        <img src={page.url} width={page.widthPx} height={page.heightPx} alt={`Página ${page.page} do caderno original`} className="block h-auto w-full" />
        {/* Contorno afastado 4 pt do texto para não cobrir a primeira letra das linhas. */}
        {box && <span aria-hidden="true" className="absolute rounded-[2px] border-2 border-ink bg-mark-yellow/20" style={pct([box[0] - 4, box[1] - 4, box[2] + 4, box[3] + 4])} />}
        {figures
          .filter((f) => f.page === page.page)
          .map((f) => (
            <span key={f.id} aria-hidden="true" className={clsx("absolute border-dashed border-ink", selected === f.id ? "border-[3px]" : "border-2")} style={pct(f.bbox_pt)} />
          ))}
      </div>
      <figcaption className="mt-1 t-meta text-ink-2">Página {page.page}</figcaption>
    </figure>
  );
}

function FigureEditor({ figure, page, originalUrl, onChange, onFocus }: { figure: Figure; page?: PageImage; originalUrl?: string; onChange: (p: Partial<Figure>) => void; onFocus: () => void }) {
  const labels = ["x inicial", "topo", "x final", "base"];
  const [x0, t, x1, b] = figure.bbox_pt;
  const valid = x0 < x1 && t < b;
  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle pt-4 first-of-type:border-0 first-of-type:pt-0" onFocus={onFocus}>
      <p className="t-ui">
        {figure.id} · {figure.role} · página {figure.page}
        {figure.recrop_pending ? " · recorte pendente" : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {originalUrl && (
          <div>
            <p className="mb-1 t-meta text-ink-2">Recorte atual</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- link assinado */}
            <img src={originalUrl} alt={figure.alt_text || `Recorte ${figure.id} (sem texto alternativo ainda)`} className="max-h-48 w-auto rounded-control border border-line-subtle" />
          </div>
        )}
        {page && valid && (
          <div>
            <p className="mb-1 t-meta text-ink-2">Prévia da caixa</p>
            <CropPreview page={page} bbox={figure.bbox_pt} alt={`Prévia da caixa ${figure.id}`} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {labels.map((label, i) => (
          <label key={label} className="flex flex-col gap-1.5 t-ui">
            <span>{label}</span>
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              value={figure.bbox_pt[i]}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                const next = [...figure.bbox_pt] as Figure["bbox_pt"];
                next[i] = v;
                onChange({ bbox_pt: next });
              }}
              className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui tabular-nums text-ink"
            />
          </label>
        ))}
      </div>
      {!valid && <p className="t-meta text-ink">Caixa inválida: o canto final precisa ficar à direita e abaixo do inicial.</p>}
      <TextArea
        label={`Texto alternativo de ${figure.id}`}
        value={figure.alt_text ?? ""}
        rows={2}
        error={textProblem(figure.alt_text ?? "") ?? undefined}
        onChange={(e) => onChange({ alt_text: e.target.value })}
      />
    </div>
  );
}

/** Mostra só a região da caixa, recortando a imagem da página por CSS. */
function CropPreview({ page, bbox, alt }: { page: PageImage; bbox: Figure["bbox_pt"]; alt: string }) {
  const bw = bbox[2] - bbox[0];
  const bh = bbox[3] - bbox[1];
  return (
    <div className="relative max-h-48 overflow-hidden rounded-control border border-line-subtle bg-surface" style={{ aspectRatio: `${bw} / ${bh}`, maxWidth: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado */}
      <img
        src={page.url}
        alt={alt}
        className="absolute max-w-none"
        style={{
          width: `${(page.cropWidthPt / bw) * 100}%`,
          height: `${(page.cropHeightPt / bh) * 100}%`,
          left: `${(-(bbox[0] - page.dxPt) / bw) * 100}%`,
          top: `${(-(bbox[1] - page.dyPt) / bh) * 100}%`,
        }}
      />
    </div>
  );
}

function Doubts({ doubts, proposalId, readOnly }: { doubts: Doubt[]; proposalId: string; readOnly: boolean }) {
  const open = doubts.filter((d) => d.status === "aberta");
  const closed = doubts.filter((d) => d.status !== "aberta");
  if (doubts.length === 0) return null;
  return (
    <section aria-labelledby="duvidas-title" className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
      <h2 id="duvidas-title" className="mb-3 t-section">
        Dúvidas ({open.length} aberta{open.length === 1 ? "" : "s"})
      </h2>
      <ul className="flex flex-col gap-4">
        {open.map((d) => (
          <DoubtItem key={d.id} doubt={d} proposalId={proposalId} readOnly={readOnly} />
        ))}
      </ul>
      {closed.length > 0 && (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 t-ui">Fechadas ({closed.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {closed.map((d) => (
              <li key={d.id} className="t-meta text-ink-2">
                <span className="text-ink">{d.kind}</span> · {d.status}: {d.resolution}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function DoubtItem({ doubt, proposalId, readOnly }: { doubt: Doubt; proposalId: string; readOnly: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (decision: "resolvida" | "descartada") =>
    start(async () => {
      const r = await closeDoubt({ proposalId, doubtId: doubt.id, decision, resolution: text });
      setMsg(r.ok ? "Dúvida fechada." : r.message);
      if (r.ok) router.refresh();
    });
  return (
    <li className="flex flex-col gap-2">
      <p className="t-ui">{doubt.kind}</p>
      {!readOnly && (
        <>
          <TextArea label="Como foi resolvida" value={text} rows={2} onChange={(e) => setText(e.target.value)} error={textProblem(text) ?? undefined} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => act("resolvida")}>
              Marcar como resolvida
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => act("descartada")}>
              Descartar dúvida
            </Button>
            <span aria-live="polite" className="t-meta text-ink">
              {msg}
            </span>
          </div>
        </>
      )}
    </li>
  );
}

function RevisionHistory({ revisions, current, viewing, proposalId, userId }: { revisions: Revision[]; current: number; viewing: number | null; proposalId: string; userId: string }) {
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  return (
    <section aria-labelledby="historico-title" className="rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
      <h2 id="historico-title" className="mb-3 flex items-center gap-2 t-section">
        <History aria-hidden="true" className="size-5" /> Histórico
      </h2>
      <ol className="flex flex-col gap-3">
        {revisions.map((r) => (
          <li key={r.revision} className={clsx("rounded-card border p-3", r.revision === (viewing ?? current) ? "border-ink" : "border-line-subtle")}>
            <p className="t-ui">
              Revisão {r.revision}
              {r.revision === current ? " (atual)" : ""}
            </p>
            <p className="t-meta text-ink-2">
              {fmt.format(new Date(r.created_at))} · {r.edited_by === null ? "importador" : r.edited_by === userId ? "você" : "outro editor"}
            </p>
            <p className="mt-1 t-meta text-ink">{r.note}</p>
            {r.changed.length > 0 && <p className="t-meta text-ink-2">Mudou: {r.changed.join(", ")}</p>}
            {r.revision !== current && r.revision !== viewing && (
              <Link href={`/editor/proposta/${proposalId}?rev=${r.revision}`} className="mt-1 inline-flex min-h-11 items-center t-ui text-link underline underline-offset-4">
                Ver revisão {r.revision}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
