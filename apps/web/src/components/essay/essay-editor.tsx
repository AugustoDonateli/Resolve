"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { PieceTimer } from "./piece-timer";
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
      <label className="flex flex-col gap-1.5 t-ui">
        Texto da redação
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          rows={18}
          spellCheck
          lang="pt-BR"
          aria-describedby="estado-rascunho contagem"
          className="min-h-[50dvh] w-full rounded-control border border-line bg-surface px-4 py-3 t-reading text-ink read-only:bg-surface-subtle"
        />
      </label>
      <p id="contagem" className="t-meta text-ink-2">
        {wordCount(text)} palavras · {paragraphs}{" "}
        {paragraphs === 1 ? "parágrafo" : "parágrafos"} · deixe uma linha em
        branco entre parágrafos
      </p>
      {!piece && <SheetPreview text={text} />}
      <p id="estado-rascunho" role="status" className="t-meta">
        {readOnly
          ? "Versão enviada: não muda mais. A reescrita cria uma nova versão."
          : STATUS_TEXT[status]}
      </p>
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
