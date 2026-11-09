import { clsx } from "clsx";

const LABEL = { valida: "Válida", duvida: "Com dúvida", rejeitada: "Rejeitada", promovida: "Promovida" } as const;

/** Estado da proposta. "Com dúvida" usa o amarelo como preenchimento com texto em tinta. */
export function StatusBadge({ status }: { status: keyof typeof LABEL }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-control px-2 py-0.5 t-meta font-medium",
        status === "duvida" ? "bg-mark-yellow text-on-mark" : "border border-line-subtle bg-surface-subtle text-ink",
      )}
    >
      {LABEL[status]}
    </span>
  );
}
