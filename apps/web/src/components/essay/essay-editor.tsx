"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  recover,
  toParagraphs,
  wordCount,
  type LocalCopy,
} from "@/lib/essay/draft";
import { saveDraft } from "@/lib/essay/draft-actions";
import type { DraftView } from "@/lib/essay/drafts";
import { pieceOf } from "@/lib/essay/pieces";
import { SubmitForCorrection } from "./submit-for-correction";
import { PieceTimer } from "./piece-timer";
import { SHEET_PROFILE, wrapLines } from "@/lib/essay/sheet";
import { SheetPreview } from "./sheet-preview";

type Status =
  | "salvo"
  | "alterado"
  | "salvando"
  | "offline"
  | "conflito"
  | "erro";
const STATUS_TEXT: Record<Status, string> = {
  salvo: "Salvo na sua conta.",
  alterado: "Alterações ainda não salvas…",
  salvando: "Salvando…",
  offline:
    "Sem conexão: o texto está guardado neste aparelho e será salvo quando a conexão voltar.",
  conflito:
    "Este rascunho foi alterado em outra aba ou aparelho. Escolha qual versão manter.",
  erro: "Não foi possível salvar agora. O texto continua guardado neste aparelho.",
};

const keyFor = (versionId: string) => `resolve:rascunho:${versionId}`;
function readLocal(versionId: string): LocalCopy | null {
  try {
    const raw = localStorage.getItem(keyFor(versionId));
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}
function writeLocal(versionId: string, copy: LocalCopy | null) {
  try {
    if (copy) localStorage.setItem(keyFor(versionId), JSON.stringify(copy));
    else localStorage.removeItem(keyFor(versionId));
  } catch {
    // armazenamento indisponível: segue com o salvamento no servidor
  }
}

/**
 * Editor de redação (F5-T05). Salva sozinho depois de uma pausa na digitação, guarda uma cópia no aparelho
 * a cada mudança e recupera ao recarregar. Se outra aba/aparelho salvou antes, mostra as duas versões e
 * o aluno escolhe — nada é sobrescrito em silêncio. Nada se move durante a escrita.
 */
const subscribeNever = () => () => {};

/**
 * As 30 linhas da folha, uma marca por linha: as usadas ficam em tinta; o que passa do limite fica
 * em caneta vermelha. É a mesma contagem da "folha simulada" (perfil fixo), vista de relance.
 */
function LineMeter({ lines }: { lines: number }) {
  const limit = SHEET_PROFILE.lineLimit;
  const over = Math.max(0, lines - limit);
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <p className="t-kicker">Linhas da folha</p>
      <ol className="flex flex-col gap-[3px]">
        {Array.from({ length: limit }, (_, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 text-right font-mono text-[9px] leading-none text-ink-2">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</span>
            <span className={clsx("h-[3px] flex-1 rounded-full transition-colors duration-[var(--rs-dur-state)]", i < lines ? "bg-ink" : "bg-line-subtle")} />
          </li>
        ))}
        {over > 0 && (
          <li className="flex items-center gap-2">
            <span className="w-5 text-right font-mono text-[9px] leading-none text-pen">+{over}</span>
            <span className="h-[3px] flex-1 rounded-full bg-pen" />
          </li>
        )}
      </ol>
      <p className="font-display text-[28px] leading-none tabular">
        {Math.min(lines, 99)}
        <span className="text-ink-2">/{limit}</span>
      </p>
    </div>
  );
}

export function EssayEditor({ draft }: { draft: DraftView }) {
  const readOnly = draft.status !== "rascunho";
  const [text, setText] = useState(draft.text);
  const [status, setStatus] = useState<Status>("salvo");
  const [conflict, setConflict] = useState<{
    text: string;
    revision: number;
  } | null>(null);
  const revision = useRef(draft.revision);
  const latest = useRef(draft.text);
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const save = useCallback(async () => {
    if (readOnly || inFlight.current) return;
    inFlight.current = true;
    const sending = latest.current;
    setStatus("salvando");
    let r: Awaited<ReturnType<typeof saveDraft>>;
    try {
      r = await saveDraft({
        versionId: draft.versionId,
        expectedRevision: revision.current,
        text: sending,
      });
    } catch {
      inFlight.current = false;
      setStatus("offline");
      return;
    }
    inFlight.current = false;
    if (r.ok) {
      revision.current = r.revision;
      if (latest.current === sending) {
        writeLocal(draft.versionId, null);
        setStatus("salvo");
      } else {
        writeLocal(draft.versionId, {
          text: latest.current,
          baseRevision: r.revision,
          savedAt: new Date().toISOString(),
        });
        setStatus("alterado");
        timer.current = window.setTimeout(() => void saveRef.current(), 400);
      }
    } else if ("conflict" in r) {
      setConflict(r.conflict);
      setStatus("conflito");
    } else {
      setStatus("erro");
    }
  }, [draft.versionId, readOnly]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Ao abrir: recupera a cópia do aparelho, se houver, ou pede escolha em conflito.
  useEffect(() => {
    if (readOnly) return;
    const t = window.setTimeout(() => {
      const rec = recover(
        draft.text,
        draft.revision,
        readLocal(draft.versionId),
      );
      if (rec.kind === "local") {
        latest.current = rec.text;
        setText(rec.text);
        setStatus("alterado");
        void save();
      } else if (rec.kind === "conflict") {
        latest.current = rec.local;
        setText(rec.local);
        setConflict({ text: rec.server, revision: draft.revision });
        setStatus("conflito");
      }
    }, 0);
    const online = () => void save();
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", online);
    };
  }, [draft, readOnly, save]);

  const onChange = (value: string) => {
    setText(value);
    latest.current = value;
    writeLocal(draft.versionId, {
      text: value,
      baseRevision: revision.current,
      savedAt: new Date().toISOString(),
    });
    if (conflict) return; // em conflito, só salva depois da escolha
    setStatus("alterado");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 1200);
  };

  const keepMine = () => {
    if (!conflict) return;
    revision.current = conflict.revision;
    setConflict(null);
    void save();
  };
  const useSaved = () => {
    if (!conflict) return;
    revision.current = conflict.revision;
    latest.current = conflict.text;
    setText(conflict.text);
    writeLocal(draft.versionId, null);
    setConflict(null);
    setStatus("salvo");
  };

  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const paragraphs = toParagraphs(text).length;
  const piece = pieceOf(draft.trainingPiece);
  return (
    <div className="flex flex-col gap-4">
      {piece && (
        <section
          aria-label={`Orientação da peça: ${piece.label}`}
          className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface p-4"
        >
          <p className="t-ui font-semibold">Peça: {piece.label}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 t-meta">
            {piece.guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {piece.minutes && !readOnly && (
            <PieceTimer essayId={draft.essayId} minutes={piece.minutes} />
          )}
        </section>
      )}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_210px] lg:items-start">
        <label className="flex min-w-0 flex-col gap-1.5 t-ui">
          Texto da redação
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            // Antes de a página "acordar" no navegador, o que fosse digitado se perderia: a folha só
            // aceita texto quando o salvamento local já está ligado.
            readOnly={readOnly || !hydrated}
            data-locked={readOnly || undefined}
            rows={18}
            spellCheck
            lang="pt-BR"
            aria-describedby="estado-rascunho contagem"
            className="folha-escrita min-h-[58dvh] w-full text-ink"
          />
        </label>
        {/* Ao lado da folha: as 30 linhas enchendo, a contagem e o estado do rascunho */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:pt-8" aria-label="Folha e rascunho">
          {!piece && <LineMeter lines={wrapLines(text).length} />}
          <p id="contagem" className="t-meta text-ink-2">
            {wordCount(text)} palavras · {paragraphs} {paragraphs === 1 ? "parágrafo" : "parágrafos"}
            <span className="block">Deixe uma linha em branco entre parágrafos.</span>
          </p>
          <p id="estado-rascunho" role="status" className="t-meta">
            {readOnly ? "Versão enviada: não muda mais. A reescrita cria uma nova versão." : STATUS_TEXT[status]}
          </p>
        </aside>
      </div>
      {!piece && <SheetPreview text={text} />}
      {!piece && (
        <SubmitForCorrection
          essayId={draft.essayId}
          versionId={draft.versionId}
          submitted={readOnly}
          canSubmit={!readOnly && status === "salvo" && !conflict && wordCount(text) >= 50}
        />
      )}
      {status === "erro" && !readOnly && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => void save()}
        >
          Tentar salvar de novo
        </Button>
      )}
      {conflict && (
        <section
          aria-labelledby="conflito"
          className="flex flex-col gap-3 rounded-panel border border-ink p-4"
        >
          <h2 id="conflito" className="t-section">
            Duas versões do rascunho
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 t-ui">
              A sua (neste aparelho)
              <textarea
                readOnly
                value={text}
                rows={8}
                className="rounded-control border border-line bg-surface-subtle px-3 py-2 t-meta text-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5 t-ui">
              A salva em outro lugar
              <textarea
                readOnly
                value={conflict.text}
                rows={8}
                className="rounded-control border border-line bg-surface-subtle px-3 py-2 t-meta text-ink"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" onClick={keepMine}>
              Manter a minha
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={useSaved}
            >
              Usar a salva em outro lugar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
