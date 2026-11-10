import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PromptReader } from "@/components/essay/prompt-reader";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getPublishedPrompt } from "@/lib/essay/prompts";

export const metadata: Metadata = { title: "Tema de redação" };
export const dynamic = "force-dynamic";

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompt = await getPublishedPrompt(id);
  return (
    <>
      <Link href="/redacao/temas" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Temas
      </Link>
      <ScreenHeader title={prompt.title} kicker={prompt.origin === "oficial" ? `Tema oficial${prompt.edition ? ` · ${prompt.edition}` : ""}` : "Tema de treino"} />
      {prompt.source_locator && <p className="-mt-3 mb-6 t-meta text-ink-2">Fonte: {prompt.source_locator}.</p>}
      <PromptReader prompt={prompt} />
    </>
  );
}
