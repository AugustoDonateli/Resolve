import { clsx } from "clsx";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";

export type SaveState = "idle" | "saving" | "saved" | "conflict";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  saveState?: SaveState;
}

/**
 * Campo de texto (plano §6): vazio, preenchido, inválido, salvando, salvo,
 * conflito; rótulo permanente e mensagem próxima.
 */
export function TextField({ label, hint, error, saveState = "idle", className, ...rest }: Props) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="t-ui text-ink">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint || saveState !== "idle" ? msgId : undefined}
        className={clsx(
          "min-h-11 rounded-control border bg-surface px-3 t-ui text-ink placeholder:text-ink-2",
          "transition-[border-color] duration-[var(--rs-dur-press)]",
          error ? "border-ink border-2 px-[11px]" : "border-line",
          "disabled:bg-disabled disabled:text-ink-2",
        )}
      />
      <p id={msgId} className="flex min-h-5 items-center gap-1.5 t-meta text-ink-2" aria-live="polite">
        {error ? (
          <>
            <AlertCircle aria-hidden="true" className="size-4 text-ink" />
            <span className="text-ink">{error}</span>
          </>
        ) : saveState === "saving" ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> Salvando…
          </>
        ) : saveState === "saved" ? (
          <>
            <Check aria-hidden="true" className="size-4" /> Salvo
          </>
        ) : saveState === "conflict" ? (
          <>
            <AlertCircle aria-hidden="true" className="size-4 text-ink" />
            <span className="text-ink">Há outra versão. Escolha qual manter.</span>
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  );
}
