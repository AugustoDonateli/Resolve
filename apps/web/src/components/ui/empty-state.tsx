import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Estado vazio: explica o próximo passo (plano §7, estados comuns). */
export function EmptyState({ icon: Icon, title, body, note, action }: { icon: LucideIcon; title: string; body: string; note?: string; action?: { href: string; label: string } }) {
  return (
    <div className="max-w-xl rounded-card border border-line-subtle bg-surface p-6">
      <Icon aria-hidden="true" className="mb-3 size-6 text-ink-2" />
      <p className="t-section">{title}</p>
      <p className="mt-1 t-reading text-ink-2">{body}</p>
      {action && (
        <Link href={action.href} className="mt-4 inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover">
          {action.label}
        </Link>
      )}
      {note && <p className="mt-4 t-meta text-ink-2">{note}</p>}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="t-meta text-ink-2">{children}</p>;
}
