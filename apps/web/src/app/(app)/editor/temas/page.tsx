import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { listEditorPrompts } from "@/lib/editor/prompts";

export const metadata: Metadata = { title: "Temas de redação" };
export const dynamic = "force-dynamic";

const STATUS = { draft: "Rascunho", published: "Publicado", retired: "Aposentado" } as const;

export default async function EditorPromptsPage() {
  const prompts = await listEditorPrompts();
  return (
    <>
      <Link href="/editor" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Revisão editorial
      </Link>
      <ScreenHeader title="Temas de redação" kicker="Área do editor" />
      <p className="mb-6 max-w-2xl t-meta text-ink-2">
        Temas e textos motivadores extraídos dos cadernos oficiais. Cada texto é conferido com a página do caderno (texto, citação e figura) antes da publicação. Nenhum tema é anunciado como previsão.
      </p>
      {prompts.length === 0 ? (
        <p className="t-ui">Nenhum tema carregado. Rode tools/ingest/temas.py e load_temas.py.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {prompts.map((p) => (
            <li key={p.id} className="rounded-card border border-line-subtle bg-surface p-4">
              <Link href={`/editor/temas/${p.id}`} className="t-section underline-offset-4 hover:underline">
                {p.title}
              </Link>
              <p className="mt-1 t-meta text-ink-2">
                {STATUS[p.status]} · {p.origin === "oficial" ? "tema oficial" : "tema editorial"}
                {p.edition ? ` · ${p.edition}` : ""} · {p.verified}/{p.texts} textos conferidos
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
