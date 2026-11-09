import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ui/wordmark";
import { authEnabled, safeNext } from "@/lib/supabase/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  if (!authEnabled) redirect("/hoje");
  const sp = await searchParams;
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="paper-grain w-full max-w-[400px] rounded-panel border border-line-subtle bg-surface p-6 shadow-paper sm:p-8">
        <Wordmark size={36} />
        <p className="mt-2 t-meta text-ink-2">Preparação para o ENEM</p>
        <h1 className="mb-6 mt-6 t-section">Entre para continuar de onde parou</h1>
        <SignInForm next={safeNext(sp.next)} linkError={sp.erro === "link"} />
      </div>
    </main>
  );
}
