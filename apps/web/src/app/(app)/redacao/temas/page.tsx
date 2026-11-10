import type { Metadata } from "next";
import { ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedPrompts } from "@/lib/essay/prompts";

export const metadata: Metadata = { title: "Temas de redação" };
export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const prompts = await listPublishedPrompts();
  return (
    <>
      <Link href="/redacao" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Temas de redação" kicker="Redação" />
      {prompts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum tema publicado ainda"
          body="Os temas entram aqui depois que cada texto motivador é conferido com o caderno oficial. Enquanto isso, a tela de correção mostra um exemplo identificado."
          action={{ href: "/redacao", label: "Voltar para Redação" }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {prompts.map((p) => (
            <li key={p.id} className="rounded-card border border-line-subtle bg-surface p-4">
              <Link href={`/redacao/temas/${p.id}`} className="t-section underline-offset-4 hover:underline">
                {p.title}
              </Link>
              <p className="mt-1 t-meta text-ink-2">{p.origin === "oficial" ? `Tema oficial${p.edition ? ` · ${p.edition}` : ""}` : "Tema de treino com fontes conferidas"}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
