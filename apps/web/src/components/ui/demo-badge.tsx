import { clsx } from "clsx";
import { FlaskConical } from "lucide-react";

/**
 * Identifica dados demonstrativos (Instrução de execução, item 3).
 * Nenhum conteúdo demonstrativo aparece sem este selo.
 */
export function DemoBadge({ children = "Demonstração", className }: { children?: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2.5 py-0.5 t-meta text-ink-2",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {children}
    </span>
  );
}
