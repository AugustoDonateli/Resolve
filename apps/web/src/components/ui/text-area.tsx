import { clsx } from "clsx";
import { AlertCircle } from "lucide-react";
import { useId, type TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Campo de texto longo: mesmo padrão do TextField (rótulo permanente, mensagem próxima). */
export function TextArea({ label, hint, error, className, rows = 3, ...rest }: Props) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="t-ui text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={clsx(
          "min-h-11 rounded-control border bg-surface px-3 py-2 t-ui font-normal text-ink placeholder:text-ink-2",
          "transition-[border-color] duration-[var(--rs-dur-press)]",
          error ? "border-ink border-2 px-[11px] py-[7px]" : "border-line",
          "disabled:bg-disabled disabled:text-ink-2",
        )}
      />
      {(error || hint) && (
        <p id={msgId} className="flex items-center gap-1.5 t-meta text-ink-2">
          {error ? (
            <>
              <AlertCircle aria-hidden="true" className="size-4 text-ink" />
              <span className="text-ink">{error}</span>
            </>
          ) : (
            hint
          )}
        </p>
      )}
    </div>
  );
}
