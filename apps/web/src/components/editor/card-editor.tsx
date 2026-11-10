"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import {
  createCard,
  deleteCardDraft,
  setCardStatus,
  type CardActionResult,
} from "@/lib/editor/card-actions";
import type { CardRow, SourceOption } from "@/lib/editor/cards";

const AREAS = [
  { v: "LC", l: "Linguagens" },
  { v: "MT", l: "Matemática" },
  { v: "CN", l: "Ciências da Natureza" },
  { v: "CH", l: "Ciências Humanas" },
  { v: "RED", l: "Redação" },
] as const;
const STATUS = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  aposentado: "Aposentado",
} as const;
const selectCls =
  "min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";

/**
 * Cartões revisados (F3-T09): conceito ou fórmula com fonte. Publicar registra a revisão do editor;
 * publicado não muda (corrigir = aposentar e criar outro). A habilidade liga o cartão aos erros do aluno.
 */
export function CardEditor({
  cards,
  sources,
}: {
  cards: CardRow[];
  sources: SourceOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    scope: string;
    r: CardActionResult;
  } | null>(null);
  const [form, setForm] = useState({
    area: "LC",
    kind: "conceito",
    skillCode: "",
    front: "",
    back: "",
    sourceId: "",
    locator: "",
  });
  const [confirm, setConfirm] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = (
    scope: string,
    fn: () => Promise<CardActionResult>,
    after?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      setResult({ scope, r });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="novo-cartao"
        className="rounded-panel border border-line bg-surface p-4 sm:p-6"
      >
        <h2 id="novo-cartao" className="mb-4 t-section">
          Novo cartão
        </h2>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "criar",
              () => createCard(form),
              () =>
                setForm((f) => ({
                  ...f,
                  skillCode: "",
                  front: "",
                  back: "",
                  locator: "",
                })),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 t-ui">
              Área
              <select
                className={selectCls}
                value={form.area}
                onChange={set("area")}
              >
                {AREAS.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 t-ui">
              Tipo
              <select
                className={selectCls}
                value={form.kind}
                onChange={set("kind")}
              >
                <option value="conceito">Conceito</option>
                <option value="formula">Fórmula</option>
              </select>
            </label>
            <TextField
              label="Habilidade da matriz (opcional)"
              hint="Ex.: H12. Liga o cartão aos erros dessa habilidade."
              value={form.skillCode}
              onChange={set("skillCode")}
            />
          </div>
          <TextArea
            label="Frente"
            rows={2}
            value={form.front}
            onChange={set("front")}
          />
          <TextArea
            label="Verso"
            rows={4}
            value={form.back}
            onChange={set("back")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 t-ui">
              Fonte
              <select
                className={selectCls}
                value={form.sourceId}
                onChange={set("sourceId")}
              >
                <option value="">Escolha a fonte</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Onde está na fonte"
              hint="Página, seção ou quadro."
              value={form.locator}
              onChange={set("locator")}
            />
          </div>
          <Button
            type="submit"
            className="self-start"
            loading={pending && result === null}
          >
            Criar rascunho
          </Button>
          <div aria-live="polite">
            {result?.scope === "criar" && (
              <p className="t-ui">
                {result.r.ok ? "Rascunho criado." : result.r.message}
              </p>
            )}
          </div>
        </form>
      </section>

      <section aria-labelledby="lista-cartoes">
        <h2 id="lista-cartoes" className="mb-3 t-section">
          Cartões
        </h2>
        {cards.length === 0 ? (
          <p className="t-ui">Nenhum cartão ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface p-4"
              >
                <p className="t-meta text-ink-2">
                  {STATUS[c.status]} ·{" "}
                  {AREAS.find((a) => a.v === c.area_code)?.l} ·{" "}
                  {c.kind === "formula" ? "fórmula" : "conceito"}
                  {c.skill ? ` · ${c.skill.code}` : " · sem habilidade"}
                </p>
                <p className="t-reading font-semibold">{c.front}</p>
                <p className="t-reading whitespace-pre-line">{c.back}</p>
                <p className="t-meta text-ink-2">
                  Fonte: {c.source?.title ?? "indisponível"} ·{" "}
                  {c.source_locator}
                </p>
                <div className="flex flex-wrap gap-3">
                  {c.status === "rascunho" &&
                    (confirm === c.id ? (
                      <div
                        role="alertdialog"
                        aria-label="Confirmar publicação do cartão"
                        className="flex flex-wrap items-center gap-3"
                      >
                        <span className="t-ui">
                          Conferiu frente, verso e fonte? Publicado não muda.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          loading={pending}
                          onClick={() =>
                            run(
                              c.id,
                              () =>
                                setCardStatus({
                                  cardId: c.id,
                                  status: "publicado",
                                }),
                              () => setConfirm(null),
                            )
                          }
                        >
                          Confirmar publicação
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => setConfirm(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setConfirm(c.id)}
                        >
                          Revisar e publicar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            run(c.id, () => deleteCardDraft({ cardId: c.id }))
                          }
                        >
                          Remover rascunho
                        </Button>
                      </>
                    ))}
                  {c.status === "publicado" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        run(c.id, () =>
                          setCardStatus({ cardId: c.id, status: "aposentado" }),
                        )
                      }
                    >
                      Aposentar
                    </Button>
                  )}
                </div>
                {result?.scope === c.id && !result.r.ok && (
                  <p role="alert" className="t-ui">
                    {result.r.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
