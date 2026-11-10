import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PromptReview } from "@/components/editor/prompt-review";
import { ScreenHeader } from "@/components/shell/app-shell";
import { getEditorPrompt } from "@/lib/editor/prompts";

export const metadata: Metadata = { title: "Revisar tema" };
export const dynamic = "force-dynamic";

export default async function EditorPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompt = await getEditorPrompt(id);
  return (
    <>
      <Link href="/editor/temas" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Temas
      </Link>
      <ScreenHeader title={prompt.title} kicker={`${prompt.origin === "oficial" ? "Tema oficial" : "Tema editorial"}${prompt.edition ? ` · ${prompt.edition}` : ""}`} />
      <PromptReview prompt={prompt} />
    </>
  );
}
