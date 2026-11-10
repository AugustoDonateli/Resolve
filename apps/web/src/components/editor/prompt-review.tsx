"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PromptReader } from "@/components/essay/prompt-reader";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import type { EditorPromptDetail } from "@/lib/editor/prompts";
import { publishPrompt, setFigureAlt, setTextVerified, type PromptActionResult } from "@/lib/editor/prompt-actions";
import { ROMAN, type MotivatingText } from "@/lib/essay/prompt-types";

/**
 * Revisão de um tema: página do caderno ao lado da extração. Cada texto é conferido com o caderno
 * (texto, citação e figura); a figura tem o texto alternativo revisável. Publicar só com a lista de
 * impedimentos vazia (o banco confere de novo).
 */
export function PromptReview({ prompt }: { prompt: EditorPromptDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ scope: string; r: PromptActionResult } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const draft = prompt.status === "draft";

  const run = (scope: string, fn: () => Promise<PromptActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult({ scope, r });
      if (r.ok) router.refresh();
    });

  const extra = (t: MotivatingText) => (
    <div className="mt-1 flex flex-col gap-3 border-t border-line-subtle pt-3">
      <p className="t-meta text-ink-2">{t.page_or_locator}</p>
      {t.blocks
        .filter((b) => b.type === "image")
        .map((b) => (
          <AltEditor key={b.id} disabled={!draft || pending} initial={b.text ?? ""} label={`Texto alternativo da figura (Texto ${ROMAN[t.position - 1]})`}
            onSave={(alt) => run(`alt-${t.id}`, () => setFigureAlt({ promptId: prompt.id, textId: t.id, blockId: b.id, alt }))} />
        ))}
      <div className="flex flex-wrap items-center gap-3">
        {t.rights_status === "verificado" ? (
          <>
            <span className="inline-flex items-center gap-1.5 t-ui">
              <CheckCircle2 aria-hidden="true" className="size-5" /> Conferido com o caderno
            </span>
            {draft && (
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(`v-${t.id}`, () => setTextVerified({ promptId: prompt.id, textId: t.id, verified: false }))}>
                Desfazer conferência
              </Button>
            )}
          </>
        ) : (
          <Button type="button" size="sm" disabled={!draft || pending} onClick={() => run(`v-${t.id}`, () => setTextVerified({ promptId: prompt.id, textId: t.id, verified: true }))}>
            Confere com o caderno
          </Button>
        )}
      </div>
      {result && (result.scope === `v-${t.id}` || result.scope === `alt-${t.id}`) && !result.r.ok && (
        <p role="alert" className="t-ui">
          {result.r.message}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="publicacao" className="rounded-panel border border-line bg-surface p-4 sm:p-6">
        <h2 id="publicacao" className="mb-2 t-section">
          Publicação
        </h2>
        {prompt.status !== "draft" ? (
          <p className="t-ui">Tema publicado. Publicado não muda; para corrigir, crie um novo tema.</p>
        ) : prompt.blockers.length > 0 ? (
          <>
            <p className="mb-2 t-ui">Ainda não pode ser publicado:</p>
            <ul className="list-disc pl-5 t-ui">
              {prompt.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </>
        ) : !confirming ? (
          <Button type="button" onClick={() => setConfirming(true)}>
            Publicar tema
          </Button>
        ) : (
          <div role="alertdialog" aria-labelledby="confirma-tema" className="flex flex-col gap-3 rounded-card border border-ink p-4">
            <p id="confirma-tema" className="t-ui">
              Publicar este tema? Ele fica visível para todas as contas e não muda depois.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" loading={pending} onClick={() => run("publicar", () => publishPrompt({ promptId: prompt.id }))}>
                Confirmar publicação
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        <div aria-live="polite">{result?.scope === "publicar" && <p className="mt-2 t-ui">{result.r.ok ? "Tema publicado." : result.r.message}</p>}</div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="caderno" className="xl:sticky xl:top-4 xl:self-start">
          <h2 id="caderno" className="mb-3 t-section">
            Caderno original
          </h2>
          {prompt.pageUrl ? (
            <div className="max-h-[80vh] overflow-auto rounded-card border border-line-subtle bg-surface" tabIndex={0} role="region" aria-label="Página do caderno original">
              {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração */}
              <img src={prompt.pageUrl} alt={`Página do caderno original (${prompt.source_locator ?? "localização indisponível"})`} className="block h-auto w-full" />
            </div>
          ) : (
            <p className="t-meta text-ink-2">Página do caderno indisponível.</p>
          )}
          <p className="mt-2 t-meta text-ink-2">{prompt.source_locator ?? "Localização no caderno indisponível."}</p>
        </section>
        <section aria-labelledby="extracao">
          <h2 id="extracao" className="mb-3 t-section">
            Extração
          </h2>
          <PromptReader prompt={prompt} renderTextExtra={extra} headingLevel={3} />
        </section>
      </div>
    </div>
  );
}

function AltEditor({ initial, label, disabled, onSave }: { initial: string; label: string; disabled: boolean; onSave: (alt: string) => void }) {
  const [value, setValue] = useState(initial);
  const changed = value.trim() !== initial.trim();
  return (
    <div className="flex flex-col gap-2">
      <TextArea label={label} value={value} rows={3} disabled={disabled} onChange={(e) => setValue(e.target.value)}
        hint="Proposta de transcrição do que a figura mostra. Confira com o caderno; salvar devolve o texto para conferência." />
      <Button type="button" size="sm" variant="secondary" className="self-start" disabled={disabled || !changed || value.trim().length < 10} onClick={() => onSave(value)}>
        Salvar texto alternativo
      </Button>
    </div>
  );
}
