"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { focusAction, type FocusState } from "@/lib/routine/plan-actions";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Foco e pausa (F4-T17). O tempo mostrado é o do servidor (intervalos gravados) mais o que passou desde a
 * última leitura; ao abrir, recarregar ou voltar à aba, o estado é relido. Não promete bloquear outros apps.
 */
export function FocusBlock({
  blockId,
  title,
  plannedMinutes,
  status,
}: {
  blockId: string;
  title: string;
  plannedMinutes: number;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(status === "em_curso");
  const [state, setState] = useState<FocusState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState({ seconds: 0, at: 0 });
  const [now, setNow] = useState(0);

  const apply = (s: FocusState) => {
    const t = performance.now();
    setBase({ seconds: s.active_seconds, at: t });
    setNow(t);
    setState(s);
  };
  /** Relê o tempo registrado no servidor (sem marcar ocupado: roda ao abrir e ao voltar à aba). */
  const refresh = async () => {
    const r = await focusAction({ blockId, action: "estado" }).catch(
      () => null,
    );
    if (r?.ok) apply(r.state);
  };
  const act = async (action: "comecar" | "pausar" | "concluir" | "estado") => {
    setBusy(true);
    setError(null);
    const r = await focusAction({ blockId, action }).catch(() => ({
      ok: false as const,
      message: "Sem conexão: tente de novo.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.message);
    apply(r.state);
    if (action === "concluir") router.refresh();
  };

  // Ao abrir e ao voltar para a aba: relê o estado do servidor (recuperação do temporizador).
  useEffect(() => {
    if (!open) return;
    const first = window.setTimeout(() => void refresh(), 0);
    const onVisible = () =>
      document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relê só quando abre
  }, [open]);

  useEffect(() => {
    if (!state?.running) return;
    const id = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(id);
  }, [state?.running]);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        {status === "em_curso" ? "Continuar foco" : "Começar foco"}
      </Button>
    );
  }
  const elapsed = state
    ? base.seconds + (state.running ? Math.max(0, now - base.at) / 1000 : 0)
    : 0;
  const target = plannedMinutes * 60;
  return (
    <div
      role="group"
      aria-label={`Foco: ${title}`}
      className="flex flex-col gap-3 rounded-card border border-ink p-4"
    >
      <p className="t-meta text-ink-2">Meta do bloco: {plannedMinutes} min</p>
      <p className="t-display tabular-nums" aria-live="off">
        {state ? mmss(elapsed) : "--:--"}
      </p>
      <p className="t-meta" role="status">
        {!state
          ? "Lendo o tempo registrado…"
          : state.status === "concluido"
            ? `Concluído: ${mmss(state.active_seconds)} registrados.`
            : state.running
              ? elapsed >= target
                ? "Tempo do bloco atingido. Conclua quando quiser."
                : "Em foco."
              : state.active_seconds > 0
                ? "Pausado."
                : "Pronto para começar."}
      </p>
      {state && state.status !== "concluido" && (
        <div className="flex flex-wrap gap-3">
          {state.running ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => act("pausar")}
            >
              Pausar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              loading={busy}
              onClick={() => act("comecar")}
            >
              {state.active_seconds > 0 ? "Retomar" : "Começar"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || state.active_seconds === 0}
            onClick={() => act("concluir")}
          >
            Concluir bloco
          </Button>
        </div>
      )}
      <p className="t-meta text-ink-2">
        O Resolve não bloqueia outros aplicativos. Para focar, silencie as
        notificações e deixe o celular longe.
      </p>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="t-ui">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
